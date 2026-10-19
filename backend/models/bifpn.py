"""
Bidirectional Feature Pyramid Network (BiFPN)
Enables multi-scale feature fusion with learned weighting for vehicle detection
across varying scales (e.g. distant small cars to close large buses).
Matches the exact architecture of improved_v2_best.pth.
"""
from typing import List, Optional, Tuple, Union
import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvBNAct(nn.Sequential):
    def __init__(self, in_channels: int, out_channels: int, kernel_size: int = 3):
        super().__init__(
            nn.Conv2d(
                in_channels,
                out_channels,
                kernel_size,
                padding=kernel_size // 2,
                bias=False,
            ),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )


class FastFusion(nn.Module):
    """
    Fast normalized feature fusion with learnable positive weights:
    Output = sum_i(w_i * Input_i) / (sum_i(w_i) + eps)
    """
    def __init__(self, n_inputs: int):
        super().__init__()
        self.weights = nn.Parameter(torch.ones(n_inputs))

    def forward(self, inputs: List[torch.Tensor]) -> torch.Tensor:
        weights = F.relu(self.weights)
        weights = weights / (weights.sum() + 1e-4)
        return sum(w * x for w, x in zip(weights, inputs))


class BiFPNBlock(nn.Module):
    """
    BiFPN Layer fusing multi-scale feature levels (P2 stride 4, P3 stride 8, P4 stride 16, P5 stride 32).
    Top-down followed by bottom-up bidirectional flow with learned feature fusion.
    """
    def __init__(self, channels: int = 64, feature_dim: Optional[int] = None):
        super().__init__()
        c = feature_dim if feature_dim is not None else channels

        self.fuse4 = FastFusion(2)
        self.fuse3 = FastFusion(2)
        self.fuse2 = FastFusion(2)
        self.fuse3_out = FastFusion(3)
        self.fuse4_out = FastFusion(3)
        self.fuse5_out = FastFusion(2)

        self.conv4 = ConvBNAct(c, c)
        self.conv3 = ConvBNAct(c, c)
        self.conv2 = ConvBNAct(c, c)
        self.conv3_out = ConvBNAct(c, c)
        self.conv4_out = ConvBNAct(c, c)
        self.conv5_out = ConvBNAct(c, c)

    @staticmethod
    def resize(x: torch.Tensor, ref: torch.Tensor) -> torch.Tensor:
        return F.interpolate(x, size=ref.shape[-2:], mode="nearest")

    def forward(self, *args) -> Union[Tuple[torch.Tensor, ...], List[torch.Tensor]]:
        if len(args) == 1 and isinstance(args[0], (list, tuple)):
            features = list(args[0])
        else:
            features = list(args)

        if len(features) == 4:
            p2, p3, p4, p5 = features

            p4_td = self.conv4(self.fuse4([
                p4, self.resize(p5, p4)
            ]))
            p3_td = self.conv3(self.fuse3([
                p3, self.resize(p4_td, p3)
            ]))
            p2_td = self.conv2(self.fuse2([
                p2, self.resize(p3_td, p2)
            ]))

            p3_out = self.conv3_out(self.fuse3_out([
                p3, p3_td, self.resize(p2_td, p3)
            ]))
            p4_out = self.conv4_out(self.fuse4_out([
                p4, p4_td, self.resize(p3_out, p4)
            ]))
            p5_out = self.conv5_out(self.fuse5_out([
                p5, self.resize(p4_out, p5)
            ]))

            return p2_td, p3_out, p4_out, p5_out
        elif len(features) == 3:
            # Flexible support for 3 features (p3, p4, p5)
            p3, p4, p5 = features
            p4_td = self.conv4(self.fuse4([p4, self.resize(p5, p4)]))
            p3_td = self.conv3(self.fuse3([p3, self.resize(p4_td, p3)]))
            p3_out = self.conv3_out(self.fuse3_out([p3, p3_td, p3]))
            p4_out = self.conv4_out(self.fuse4_out([p4, p4_td, self.resize(p3_out, p4)]))
            p5_out = self.conv5_out(self.fuse5_out([p5, self.resize(p4_out, p5)]))
            return p3_out, p4_out, p5_out
        else:
            raise ValueError(f"Expected 3 or 4 feature tensors, got {len(features)}")
