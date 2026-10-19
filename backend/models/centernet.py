"""
Improved CenterNet Model Architecture for Vehicle Detection
Backbone: ResNet-18
Attention: CBAM (Channel & Spatial Attention)
Neck: BiFPN (Multi-scale weighted bidirectional feature pyramid)
Heads: Heatmap (4 vehicle classes), Size (WH), Subpixel Offset (Reg)
"""
import math
from typing import Dict, List, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models

from backend.models.cbam import CBAM
from backend.models.bifpn import BiFPNBlock

VEHICLE_CLASSES = ["car", "van", "bus", "others"]


class ResNet18Backbone(nn.Module):
    """
    ResNet-18 backbone extracting multi-scale features:
    C3 (stride 8, 128 channels)
    C4 (stride 16, 256 channels)
    C5 (stride 32, 512 channels)
    with CBAM attention integrated at each stage.
    """
    def __init__(self, use_cbam: bool = True):
        super().__init__()
        try:
            resnet = models.resnet18(weights=models.ResNet18_Weights.DEFAULT if hasattr(models, "ResNet18_Weights") else None)
        except Exception:
            resnet = models.resnet18(weights=None)
        self.conv1 = resnet.conv1
        self.bn1 = resnet.bn1
        self.relu = resnet.relu
        self.maxpool = resnet.maxpool

        self.layer1 = resnet.layer1  # 64 channels, stride 4
        self.layer2 = resnet.layer2  # 128 channels, stride 8
        self.layer3 = resnet.layer3  # 256 channels, stride 16
        self.layer4 = resnet.layer4  # 512 channels, stride 32

        self.use_cbam = use_cbam
        if use_cbam:
            self.cbam2 = CBAM(128)
            self.cbam3 = CBAM(256)
            self.cbam4 = CBAM(512)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        c1 = self.layer1(x)
        c2 = self.layer2(c1)
        if self.use_cbam:
            c2 = self.cbam2(c2)

        c3 = self.layer3(c2)
        if self.use_cbam:
            c3 = self.cbam3(c3)

        c4 = self.layer4(c3)
        if self.use_cbam:
            c4 = self.cbam4(c4)

        return c2, c3, c4  # c2: stride 8 (128), c3: stride 16 (256), c4: stride 32 (512)


class ImprovedCenterNet(nn.Module):
    """
    Improved CenterNet vehicle detection network.
    Integrates ResNet-18 backbone, CBAM attention, BiFPN feature fusion,
    and anchor-free keypoint detection heads.
    """
    def __init__(
        self,
        num_classes: int = 4,
        feature_dim: int = 128,
        use_cbam: bool = True,
        use_bifpn: bool = True,
    ):
        super().__init__()
        self.num_classes = num_classes
        self.feature_dim = feature_dim
        self.use_cbam = use_cbam
        self.use_bifpn = use_bifpn

        # Backbone
        self.backbone = ResNet18Backbone(use_cbam=use_cbam)

        # BiFPN input projections
        self.proj_c2 = nn.Conv2d(128, feature_dim, kernel_size=1)
        self.proj_c3 = nn.Conv2d(256, feature_dim, kernel_size=1)
        self.proj_c4 = nn.Conv2d(512, feature_dim, kernel_size=1)

        # BiFPN block
        if use_bifpn:
            self.bifpn = BiFPNBlock(feature_dim=feature_dim)
        else:
            self.bifpn = None

        # Upsampling neck to stride 4
        # Upsamples stride 8 features to stride 4 (CenterNet standard output resolution)
        self.up_stride4 = nn.Sequential(
            nn.ConvTranspose2d(feature_dim, feature_dim, kernel_size=4, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(feature_dim),
            nn.ReLU(inplace=True),
            nn.Conv2d(feature_dim, feature_dim, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(feature_dim),
            nn.ReLU(inplace=True),
        )

        # CenterNet Detection Heads
        # 1. Heatmap Head (Vehicle Center Keypoints)
        self.head_hm = nn.Sequential(
            nn.Conv2d(feature_dim, feature_dim, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(feature_dim, num_classes, kernel_size=1),
        )
        # Initialize heatmap bias to -2.19 (prob 0.1) as standard in focal loss CenterNet
        self.head_hm[-1].bias.data.fill_(-2.19)

        # 2. Width and Height Head (WH)
        self.head_wh = nn.Sequential(
            nn.Conv2d(feature_dim, feature_dim, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(feature_dim, 2, kernel_size=1),
        )

        # 3. Sub-pixel Offset Head (Offset / Reg)
        self.head_reg = nn.Sequential(
            nn.Conv2d(feature_dim, feature_dim, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(feature_dim, 2, kernel_size=1),
        )

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        c2, c3, c4 = self.backbone(x)

        p3 = self.proj_c2(c2)
        p4 = self.proj_c3(c3)
        p5 = self.proj_c4(c4)

        if self.use_bifpn and self.bifpn is not None:
            p3_fused, p4_fused, p5_fused = self.bifpn(p3, p4, p5)
            # Combine high-level context with fine stride-8 features
            fused_base = p3_fused + F.interpolate(p4_fused, size=p3_fused.shape[-2:], mode="nearest")
        else:
            fused_base = p3 + F.interpolate(p4, size=p3.shape[-2:], mode="nearest")

        feat = self.up_stride4(fused_base)

        hm = self.head_hm(feat).sigmoid()
        wh = F.relu(self.head_wh(feat))
        reg = self.head_reg(feat)

        return {
            "hm": hm,    # [B, 4, H/4, W/4]
            "wh": wh,    # [B, 2, H/4, W/4]
            "reg": reg,  # [B, 2, H/4, W/4]
        }


def decode_centernet(
    hm: torch.Tensor,
    wh: torch.Tensor,
    reg: torch.Tensor,
    k: int = 100,
    down_ratio: int = 4,
    conf_thresh: float = 0.3,
) -> List[Dict]:
    """
    Decodes CenterNet keypoint heatmaps and regression maps into bounding boxes.
    Applies 3x3 max pooling for fast non-maximum suppression (NMS).
    
    Returns list of detections:
    {
        "bbox": [x1, y1, x2, y2], (in normalized coordinates 0.0 - 1.0 or pixel coordinates)
        "score": float,
        "class_id": int,
        "class_name": str,
        "center": [cx, cy]
    }
    """
    batch_size, num_classes, h, w = hm.shape

    # 3x3 Max Pooling for Keypoint NMS
    hmax = F.max_pool2d(hm, kernel_size=3, padding=1, stride=1)
    keep = (hmax == hm).float()
    hm = hm * keep

    # Flatten heatmap to find top K keypoints across all classes
    hm_flat = hm.view(batch_size, -1)
    topk_scores, topk_inds = torch.topk(hm_flat, k)

    topk_clses = topk_inds // (h * w)
    topk_inds = topk_inds % (h * w)
    topk_ys = (topk_inds // w).float()
    topk_xs = (topk_inds % w).float()

    # Extract sub-pixel offsets
    reg_flat = reg.view(batch_size, 2, -1)
    # Gather offsets at topk_inds
    reg_x = torch.gather(reg_flat[:, 0, :], 1, topk_inds)
    reg_y = torch.gather(reg_flat[:, 1, :], 1, topk_inds)

    # Refined center coordinates
    xs = (topk_xs + reg_x) * down_ratio
    ys = (topk_ys + reg_y) * down_ratio

    # Extract WH
    wh_flat = wh.view(batch_size, 2, -1)
    w_pred = torch.gather(wh_flat[:, 0, :], 1, topk_inds) * down_ratio
    h_pred = torch.gather(wh_flat[:, 1, :], 1, topk_inds) * down_ratio

    detections = []
    # For single batch element (batch_size=1)
    scores = topk_scores[0].cpu().numpy()
    clses = topk_clses[0].cpu().numpy()
    cx = xs[0].cpu().numpy()
    cy = ys[0].cpu().numpy()
    pw = w_pred[0].cpu().numpy()
    ph = h_pred[0].cpu().numpy()

    for i in range(k):
        score = float(scores[i])
        if score < conf_thresh:
            continue
        c_id = int(clses[i])
        if c_id >= len(VEHICLE_CLASSES):
            c_id = 0

        center_x = float(cx[i])
        center_y = float(cy[i])
        box_w = max(float(pw[i]), 8.0)
        box_h = max(float(ph[i]), 8.0)

        x1 = center_x - box_w / 2.0
        y1 = center_y - box_h / 2.0
        x2 = center_x + box_w / 2.0
        y2 = center_y + box_h / 2.0

        detections.append({
            "bbox": [x1, y1, x2, y2],
            "score": round(score, 4),
            "class_id": c_id,
            "class_name": VEHICLE_CLASSES[c_id],
            "center": [center_x, center_y],
        })

    return detections
