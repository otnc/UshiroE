# Change Log

## [0.1.1]

### Added

- Implement background overlay with cross-fade animations for images
- Add patch repair notifications for outdated backgrounds and improve related messages

## [0.1.0]

### Added

- Add settings model, normalization and image source resolution
- Inject a live-updating background runtime into the workbench
- Import settings from BackImage
- Add commands and the background panel view
- Add pixel art icons generated with dfh
- Copy images into a library folder, download URLs and add random presets
- Keep the title bar clear of the full-window background
- Change All images only at startup by default
- Let the user choose whether UshiroE or BackImage owns the workbench
- Restore the workbench from a saved copy, also by running the uninstall hook by hand
- Import image sources once instead of syncing them with their originals
- List sources by name and image count and move the original into the details
- Turn presets into ordered image lists and add change-at-startup rotation
- Edit presets and reorder sources and images in the panel


### Changed

- Split the controller and share patch planning with the uninstall hook


### Fixed

- Do not hold up activation while the startup patch check waits for a dialog
- Serialize workbench writes across windows and stop startup repair loops
- Write workbench files atomically, verify them and roll back on failure
- Refuse to patch truncated or foreign-modified workbench files

# Change Log
