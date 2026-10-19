# Model Checkpoints Directory

Place your custom trained PyTorch weights for **Improved CenterNet** here.

### Expected Filename:
`best_improved_centernet.pth` or any `.pth` / `.pt` checkpoint file.

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
