#!/bin/bash

# Find the built app bundle
APP_PATH="/Users/simonkelly/Development/Projects/Floatlearn/tauri-app/src-tauri/target/release/bundle/macos/Floatlearn.app"

if [ -d "$APP_PATH" ]; then
    echo "Found app bundle at: $APP_PATH"
    
    # Add LSUIElement to Info.plist
    /usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$APP_PATH/Contents/Info.plist" 2>/dev/null || \
    /usr/libexec/PlistBuddy -c "Set :LSUIElement true" "$APP_PATH/Contents/Info.plist"
    
    echo "✅ Added LSUIElement to Info.plist"
    echo "The app should now not appear in the dock when built."
    
    # Show the relevant part of the plist
    echo "Info.plist LSUIElement setting:"
    /usr/libexec/PlistBuddy -c "Print :LSUIElement" "$APP_PATH/Contents/Info.plist"
else
    echo "❌ App bundle not found. Build the app first with: npm run tauri build"
fi