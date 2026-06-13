# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# react-native-get-random-values (crypto polyfill for nanoid in bridgeless mode)
-keep class com.bitgo.random.** { *; }
-keep class com.uitest.** { *; }
# 通用 RN bridge modules（防止 R8 砍 native module class）
-keep class com.facebook.react.bridge.** { *; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep @com.facebook.react.module.annotations.ReactModule class * { *; }
# fflate (gunzipSync 命名 import 防 tree-shake)
-keep class fflate.** { *; }

# Add any project specific keep options here:
