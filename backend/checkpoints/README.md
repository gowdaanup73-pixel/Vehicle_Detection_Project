# Model Checkpoints Directory

Place your custom trained PyTorch weights for **Improved CenterNet** here.

### Available Checkpoints:
- `improved_v2_best.pth`: Improved CenterNet v2 (ResNet-18 + CBAM + BiFPN) best validation checkpoint (active default).
- `improved_v2_latest.pth`: Improved CenterNet v2 latest training recovery checkpoint.
- `improved_v2_epochs/`: Per-epoch weights (`epoch_01.pth` through `epoch_06.pth`).
- `improved_best.pth`: Improved CenterNet v1 best checkpoint.
- `improved_latest.pth`: Improved CenterNet v1 latest checkpoint.
- `centernet_best.pth`: Baseline CenterNet best checkpoint.
- `centernet_latest.pth`: Baseline CenterNet latest checkpoint.

### Expected Filename:
`improved_v2_best.pth`, `best_improved_centernet.pth` or any `.pth` / `.pt` checkpoint file.

### How to Save Weights in Google Colab:
```python
# In your Colab training script:
import torch

# Recommended: save model state dict
torch.save(model.state_dict(), 'best_improved_centernet.pth')

# Or if saving checkpoint dictionary:
torch.save({
    'epoch': epoch,
    'state_dict': model.state_dict(),
    'val_map': best_map,
}, 'best_improved_centernet.pth')
```

### Class Mapping (UA-DETRAC):
- `0`: `car`
- `1`: `van`
- `2`: `bus`
- `3`: `others`

Once placed here, restart the platform or click **"Refresh Checkpoint Scan"** in the Model Laboratory to immediately switch to full deep neural network inference.
