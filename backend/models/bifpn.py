"""
Bidirectional Feature Pyramid Network (BiFPN)
Enables multi-scale feature fusion with learned weighting for vehicle detection
across varying scales (e.g. distant small cars to close large buses).
"""
import torch
import torch.nn as nn
import torch.nn.functional as F


class FastNormalizedFusion(nn.Module):
    """
    Fast normalized feature fusion with learnable positive weights:
    Output = sum_i(w_i * Input_i) / (sum_i(w_i) + eps)
    """
    def __init__(self, num_inputs: int, eps: float = 1e-4):
        super().__init__()
        self.num_inputs = num_inputs
        self.eps = eps
        self.weights = nn.Parameter(torch.ones(num_inputs, dtype=torch.float32))

    def forward(self, inputs: list) -> torch.Tensor:
        w = F.relu(self.weights)
        w_sum = torch.sum(w) + self.eps
        out = sum(w[i] * inputs[i] for i in range(self.num_inputs))
        return out / w_sum


class DepthwiseSeparableConv(nn.Module):
    """Depthwise separable convolution with BatchNorm and Swish / ReLU for parameter efficiency."""
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.depthwise = nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1, groups=in_channels, bias=False)
        self.pointwise = nn.Conv2d(in_channels, out_channels, kernel_size=1, bias=False)
        self.bn = nn.BatchNorm2d(out_channels)
        self.act = nn.SiLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.act(self.bn(self.pointwise(self.depthwise(x))))


class BiFPNBlock(nn.Module):
    """
    Single BiFPN Layer fusing P3 (stride 8), P4 (stride 16), P5 (stride 32).
    Top-down followed by bottom-up bidirectional flow.
    """
    def __init__(self, feature_dim: int = 128):
        super().__init__()
        self.feature_dim = feature_dim

        # Top-down fusion
        self.fuse_td_p4 = FastNormalizedFusion(2)
        self.conv_td_p4 = DepthwiseSeparableConv(feature_dim, feature_dim)

        self.fuse_td_p3 = FastNormalizedFusion(2)
        self.conv_td_p3 = DepthwiseSeparableConv(feature_dim, feature_dim)

        # Bottom-up fusion
        self.fuse_bu_p4 = FastNormalizedFusion(3)
        self.conv_bu_p4 = DepthwiseSeparableConv(feature_dim, feature_dim)

        self.fuse_bu_p5 = FastNormalizedFusion(2)
        self.conv_bu_p5 = DepthwiseSeparableConv(feature_dim, feature_dim)

    def forward(self, p3: torch.Tensor, p4: torch.Tensor, p5: torch.Tensor):
        # Top-down pathway
        # Resize p5 to p4 size
        p5_td = F.interpolate(p5, size=p4.shape[-2:], mode="nearest")
        p4_td = self.conv_td_p4(self.fuse_td_p4([p4, p5_td]))

        # Resize p4_td to p3 size
        p4_td_resized = F.interpolate(p4_td, size=p3.shape[-2:], mode="nearest")
        p3_out = self.conv_td_p3(self.fuse_td_p3([p3, p4_td_resized]))

        # Bottom-up pathway
        # Resize p3_out to p4 size via maxpool or strided conv
        p3_down = F.max_pool2d(p3_out, kernel_size=2, stride=2)
        p4_out = self.conv_bu_p4(self.fuse_bu_p4([p4, p4_td, p3_down]))

        # Resize p4_out to p5 size
        p4_down = F.max_pool2d(p4_out, kernel_size=2, stride=2)
        p5_out = self.conv_bu_p5(self.fuse_bu_p5([p5, p4_down]))

        return p3_out, p4_out, p5_out
