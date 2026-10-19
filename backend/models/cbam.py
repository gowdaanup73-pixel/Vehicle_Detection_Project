"""
Convolutional Block Attention Module (CBAM)
Provides Channel Attention followed by Spatial Attention for feature refinement
in Improved CenterNet. Matches the exact architecture of improved_v2_best.pth.
"""
from typing import Optional
import torch
import torch.nn as nn
import torch.nn.functional as F


class CBAM(nn.Module):
    """
    CBAM combines Channel and Spatial attention sequentially.
    Applied to projected multi-scale feature maps in ResNet-18 stages to enhance
    salient vehicle regions against complex urban backgrounds.
    """
    def __init__(
        self,
        channels: int = 64,
        reduction: int = 16,
        in_planes: Optional[int] = None,
        ratio: Optional[int] = None,
        kernel_size: int = 7,
    ):
        super().__init__()
        c = in_planes if in_planes is not None else channels
        r = ratio if ratio is not None else reduction
        hidden = max(c // r, 4)

        self.mlp = nn.Sequential(
            nn.Conv2d(c, hidden, 1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(hidden, c, 1, bias=False),
        )
        self.spatial = nn.Conv2d(
            2, 1, kernel_size=kernel_size, padding=kernel_size // 2, bias=False
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        channel_weight = torch.sigmoid(
            self.mlp(F.adaptive_avg_pool2d(x, 1))
            + self.mlp(F.adaptive_max_pool2d(x, 1))
        )
        x = x * channel_weight

        avg = x.mean(dim=1, keepdim=True)
        maximum = x.max(dim=1, keepdim=True).values
        spatial_weight = torch.sigmoid(
            self.spatial(torch.cat([avg, maximum], dim=1))
        )
        return x * spatial_weight
