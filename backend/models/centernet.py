"""
Improved CenterNet Model Architecture for Vehicle Detection
Backbone: ResNet-18
Projections: Four 64-channel feature projections
Attention: CBAM (Channel & Spatial Attention)
Neck: Two BiFPN blocks with learned feature fusion
Heads: Heatmap (4 vehicle classes), Size (WH), Subpixel Offset (Off/Reg)
Matches the exact trained architecture of improved_v2_best.pth.
"""
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import resnet18

from backend.models.cbam import CBAM
from backend.models.bifpn import BiFPNBlock, ConvBNAct

VEHICLE_CLASSES = ["car", "van", "bus", "others"]


class ImprovedCenterNet(nn.Module):
    """
    Improved CenterNet vehicle detection network.
    Integrates ResNet-18 backbone, four 64-channel feature projections,
    CBAM attention, two BiFPN blocks with learned feature fusion,
    and anchor-free keypoint detection heads.
    """
    def __init__(
        self,
        num_classes: int = 4,
        feature_dim: int = 64,
        **kwargs,
    ):
        super().__init__()
        self.num_classes = num_classes
        self.feature_dim = feature_dim

        self.backbone = resnet18(weights=None)
        self.backbone.fc = nn.Identity()

        channels = [64, 128, 256, 512]
        self.projections = nn.ModuleList([
            ConvBNAct(c, feature_dim, kernel_size=1)
            for c in channels
        ])
        self.attention = nn.ModuleList([
            CBAM(feature_dim) for _ in channels
        ])

        self.bifpn = nn.ModuleList([
            BiFPNBlock(feature_dim),
            BiFPNBlock(feature_dim),
        ])

        def make_head(output_channels: int) -> nn.Sequential:
            return nn.Sequential(
                nn.Conv2d(feature_dim, feature_dim, kernel_size=3, padding=1),
                nn.ReLU(inplace=True),
                nn.Conv2d(feature_dim, output_channels, kernel_size=1),
            )

        self.hm_head = make_head(num_classes)
        self.wh_head = make_head(2)
        self.off_head = make_head(2)

        # Initialize heatmap bias to -2.19 (prob ~0.1) as standard in focal loss CenterNet
        nn.init.constant_(self.hm_head[-1].bias, -2.19)

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        b = self.backbone

        x = b.maxpool(b.relu(b.bn1(b.conv1(x))))
        c2 = b.layer1(x)  # stride 4,  64 channels
        c3 = b.layer2(c2) # stride 8,  128 channels
        c4 = b.layer3(c3) # stride 16, 256 channels
        c5 = b.layer4(c4) # stride 32, 512 channels

        features = [
            attention(project(feature))
            for project, attention, feature in zip(
                self.projections,
                self.attention,
                [c2, c3, c4, c5],
            )
        ]

        for block in self.bifpn:
            features = block(features)

        # Level 0 feature is stride 4 with 64 channels
        fused_stride4 = features[0]

        hm = self.hm_head(fused_stride4)
        wh = self.wh_head(fused_stride4)
        off = self.off_head(fused_stride4)

        return {
            "hm": hm,
            "wh": wh,
            "off": off,
            "reg": off,  # Backward compatible alias for offset head
        }


def decode_centernet(
    hm: torch.Tensor,
    wh: torch.Tensor,
    reg: torch.Tensor,
    k: int = 100,
    down_ratio: int = 4,
    conf_thresh: float = 0.35,
    original_size: Optional[Tuple[int, int]] = None,
    input_size: Optional[Tuple[int, int]] = None,
) -> List[Dict]:
    """
    Decodes CenterNet keypoint heatmaps and regression maps into bounding boxes.
    Applies sigmoid activation (if not already activated), 3x3 max pooling for local peak suppression,
    top-K keypoint gathering, sub-pixel offset correction, and width/height decoding.
    
    If original_size=(orig_w, orig_h) and input_size=(input_w, input_h) are provided,
    scales coordinates to original image and performs boundary clipping and invalid box filtering.
    """
    # 1. Heatmap activation: apply sigmoid if inputs are raw logits
    if hm.min() < 0.0 or hm.max() > 1.0:
        hm = hm.sigmoid()

    # 2. 3x3 local max pooling suppression
    pooled = F.max_pool2d(hm, kernel_size=3, stride=1, padding=1)
    hm = hm * (hm == pooled).to(hm.dtype)

    batch_size, num_classes, out_h, out_w = hm.shape
    k = min(k, num_classes * out_h * out_w)

    # 3. Top-K selection across all classes
    scores_flat = hm.reshape(batch_size, -1)
    top_scores, top_indices = torch.topk(scores_flat, k=k, dim=1)

    spatial_indices = top_indices % (out_h * out_w)
    class_indices = top_indices // (out_h * out_w)

    ys = (spatial_indices // out_w).float()
    xs = (spatial_indices % out_w).float()

    # 4. Rearrange width/height and offset heads for gathering
    wh_flat = wh.permute(0, 2, 3, 1).reshape(batch_size, -1, 2)
    off_flat = reg.permute(0, 2, 3, 1).reshape(batch_size, -1, 2)

    gather_indices = spatial_indices.unsqueeze(-1).expand(-1, -1, 2)

    wh_pred = wh_flat.gather(1, gather_indices)
    off_pred = off_flat.gather(1, gather_indices)

    # 5. Coordinate decoding using output stride
    centers_x = (xs + off_pred[..., 0]) * float(down_ratio)
    centers_y = (ys + off_pred[..., 1]) * float(down_ratio)

    widths = wh_pred[..., 0].clamp(min=0) * float(down_ratio)
    heights = wh_pred[..., 1].clamp(min=0) * float(down_ratio)

    x1 = centers_x - widths / 2.0
    y1 = centers_y - heights / 2.0
    x2 = centers_x + widths / 2.0
    y2 = centers_y + heights / 2.0

    scores_np = top_scores[0].detach().cpu().numpy()
    classes_np = class_indices[0].detach().cpu().numpy()
    boxes_np = torch.stack([x1[0], y1[0], x2[0], y2[0]], dim=-1).detach().cpu().numpy()

    scale_x = 1.0
    scale_y = 1.0
    bound_w = float(out_w * down_ratio)
    bound_h = float(out_h * down_ratio)

    if original_size is not None and input_size is not None:
        orig_w, orig_h = original_size
        inp_w, inp_h = input_size
        scale_x = orig_w / float(inp_w)
        scale_y = orig_h / float(inp_h)
        bound_w = float(orig_w)
        bound_h = float(orig_h)

    detections = []
    for i in range(k):
        score = float(scores_np[i])
        if score < conf_thresh:
            continue

        c_idx = int(classes_np[i])
        if c_idx >= len(VEHICLE_CLASSES):
            c_idx = 0

        bx1, by1, bx2, by2 = boxes_np[i]

        bx1 = bx1 * scale_x
        bx2 = bx2 * scale_x
        by1 = by1 * scale_y
        by2 = by2 * scale_y

        # Boundary clipping
        bx1 = float(np.clip(bx1, 0, bound_w))
        bx2 = float(np.clip(bx2, 0, bound_w))
        by1 = float(np.clip(by1, 0, bound_h))
        by2 = float(np.clip(by2, 0, bound_h))

        box_w = bx2 - bx1
        box_h = by2 - by1

        # Invalid-box filtering
        if not np.isfinite([bx1, by1, box_w, box_h, score]).all():
            continue
        if box_w <= 0.0 or box_h <= 0.0:
            continue

        detections.append({
            "bbox": [round(bx1, 1), round(by1, 1), round(bx2, 1), round(by2, 1)],
            "score": round(score, 4),
            "class_id": c_idx,
            "class_name": VEHICLE_CLASSES[c_idx],
            "center": [round((bx1 + bx2) / 2.0, 1), round((by1 + by2) / 2.0, 1)],
        })

    return detections
