# Drag and Drop Feature for Image Editor

## Overview

The Image Editor now supports drag and drop functionality that allows users to drop image files directly onto the canvas to create new layers.

## How It Works

### Drag and Drop Implementation

1. **Canvas Event Handlers**: The `ImageEditorCanvas` component includes drag and drop event handlers:
   - `onDragOver`: Prevents default behavior and shows visual feedback
   - `onDragLeave`: Resets visual feedback when dragging leaves the canvas
   - `onDrop`: Handles the dropped files and creates new layers

2. **Visual Feedback**: When dragging files over the canvas:
   - The canvas border changes to a dashed blue line
   - The background gets a light blue tint
   - A centered overlay appears with instructions
   - Smooth transitions provide clear user feedback

3. **File Processing**: The drop handler:
   - Filters for image files (JPG, PNG, GIF, WebP)
   - Takes the first image file from the dropped files
   - Calls the `onImageDrop` callback with the file

### Layer Creation

When an image is dropped:

1. **New Layer Creation**: The `ImageEditor` component creates a new layer with:
   - Unique ID based on timestamp
   - Name from the file name or default "Layer X"
   - Default visibility and lock settings
   - Default filter settings
   - Full opacity (100%)
   - `isEmpty: false` (layer has content)
   - The dropped image file attached

2. **Layer Selection**: The newly created layer is automatically selected

3. **Layer Stacking**: New layers are added to the top of the layer stack

### Layer System Integration

The layer system has been extended to support:

- **Image Property**: Layers can now have an optional `image` property containing a `File` object
- **Texture Caching**: The canvas maintains a texture cache for layer-specific images
- **Multi-Layer Rendering**: Each layer can have its own image and filters

## Usage

### For Users

1. **Drag an image file** from your file system onto the canvas
2. **Visual feedback** will appear indicating the drop zone
3. **Drop the file** to create a new layer
4. **The new layer** will be automatically selected and visible in the layer panel
5. **Apply filters** to the new layer using the editor tools

### For Developers

The implementation includes:

- **TypeScript Support**: Full type safety for all drag and drop operations
- **Error Handling**: Graceful handling of non-image files
- **Performance**: Efficient texture caching and cleanup
- **Accessibility**: Proper ARIA labels and keyboard support

## Technical Details

### Event Flow

1. User drags file over canvas → `handleDragOver` → Visual feedback
2. User drops file → `handleDrop` → File validation → `onImageDrop` callback
3. `ImageEditor.handleImageDrop` → Layer creation → State update
4. Canvas re-renders with new layer

### File Validation

The drop handler validates files by:
- Checking `file.type.startsWith('image/')`
- Supporting common image formats: JPG, PNG, GIF, WebP
- Taking the first valid image file if multiple files are dropped

### Memory Management

- Image URLs are created using `URL.createObjectURL()`
- URLs are properly cleaned up when layers are removed
- Texture cache is maintained for performance
- Old textures are deleted when layers are removed

## Future Enhancements

Potential improvements could include:

- **Multiple File Support**: Allow dropping multiple images at once
- **Drag from Browser**: Support dragging images from web pages
- **Layer Positioning**: Allow dropping at specific canvas coordinates
- **File Size Limits**: Add validation for maximum file sizes
- **Progress Indicators**: Show loading states for large images

## Testing

To test the feature:

1. Open the image editor
2. Drag an image file from your computer onto the canvas
3. Verify that a new layer appears in the layer panel
4. Check that the layer is selected and visible
5. Apply some filters to verify the layer works correctly 
