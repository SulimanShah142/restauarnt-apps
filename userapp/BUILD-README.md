# 🚀 AYAR Food Delivery - Production Build Guide

## 📋 Automated Build Scripts

Two automated scripts have been created to **permanently fix cache-related crashes**:

### **Windows:** `build-production.ps1`
### **Mac/Linux:** `build-production.sh`

---

## 🎯 What These Scripts Do

### **Automatically:**
1. ✅ Stop all running processes (Node, Expo)
2. ✅ Clear Expo cache (`.expo` folder)
3. ✅ Clear Metro bundler cache (`node_modules/.cache`)
4. ✅ Clear Expo shared cache (`.`expo-shared`)
5. ✅ Clear npm cache
6. ✅ Delete `node_modules`
7. ✅ Reinstall all dependencies fresh
8. ✅ Update version in `app.config.js`
9. ✅ Build production APK with `--clean` flag

### **Result:**
- ✅ **No stale cache** in production builds
- ✅ **Works perfectly** on first launch
- ✅ **No cache-related crashes**
- ✅ **Consistent behavior** across all devices
- ✅ **Self-contained APK**

---

## 📖 HOW TO USE

### **Windows (PowerShell):**

```powershell
# 1. Open PowerShell in userapp folder
cd C:\Users\Administrator\restaurant-app\userapp

# 2. Run the build script
.\build-production.ps1

# OR with custom version:
.\build-production.ps1 -version "1.0.1"
```

### **Mac/Linux (Terminal):**

```bash
# 1. Navigate to userapp folder
cd /path/to/restaurant-app/userapp

# 2. Make script executable (first time only)
chmod +x build-production.sh

# 3. Run the build script
./build-production.sh

# OR with custom version:
./build-production.sh "1.0.1"
```

---

## 🔧 SCRIPT OPTIONS

### **Windows (`build-production.ps1`):**

```powershell
# Default version (1.0.0)
.\build-production.ps1

# Custom version
.\build-production.ps1 -version "1.0.1"

# Custom version and version code
.\build-production.ps1 -version "1.0.1" -versionCode "2"
```

### **Mac/Linux (`build-production.sh`):**

```bash
# Default version (1.0.0)
./build-production.sh

# Custom version (edit VERSION variable in script)
# Open script and change: VERSION="1.0.1"
./build-production.sh
```

---

## ⚙️ WHAT HAPPENS DURING BUILD

### **Step 1: Stopping Processes** ⏹️
```
Stopping Node processes...
✅ Processes stopped
```

### **Step 2: Clearing Caches** 🧹
```
Clearing Expo cache (.expo folder)...
✅ .expo folder deleted

Clearing Metro cache (node_modules/.cache)...
✅ Metro cache deleted

Clearing Expo shared cache (.expo-shared)...
✅ .expo-shared folder deleted

Clearing npm cache...
✅ npm cache cleared
```

### **Step 3: Reinstalling Dependencies** 📦
```
Removing node_modules...
✅ node_modules deleted

Installing fresh dependencies (this may take 2-5 minutes)...
[npm install progress...]
✅ Dependencies installed successfully
```

### **Step 4: Updating Version** 📝
```
Updating app.config.js with version 1.0.0...
✅ app.config.js updated
```

### **Step 5: Building Production APK** 🚀
```
Starting EAS Build (this will take 15-25 minutes)...
You can monitor progress at: https://expo.dev/accounts

[eas build progress...]

======================================
  ✅ BUILD SUCCESSFUL!
======================================

📦 Your APK/AAB will be available at:
https://expo.dev/accounts/your-account/projects/userapp/builds
```

---

## 🎯 WHEN TO USE THIS SCRIPT

### **Use Before EVERY Production Build:**
- ✅ First production release
- ✅ App updates
- ✅ Bug fix releases
- ✅ Feature updates
- ✅ Any time you submit to Play Store

### **Don't Use For:**
- ❌ Development testing (use `npx expo start` instead)
- ❌ Quick tests (use development client)
- ❌ Debugging (use development mode)

---

## 📋 MANUAL BUILD (If Script Fails)

If the automated script doesn't work, run these commands manually:

```bash
# Windows PowerShell:
cd userapp
Stop-Process -Name "node" -Force
Remove-Item -Recurse -Force .expo
Remove-Item -Recurse -Force node_modules\.cache
Remove-Item -Recurse -Force .expo-shared
npm cache clean --force
Remove-Item -Recurse -Force node_modules
npm install
eas build --platform android --profile production --clean

# Mac/Linux:
cd userapp
killall node
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .expo-shared
npm cache clean --force
rm -rf node_modules
npm install
eas build --platform android --profile production --clean
```

---

## 🐛 TROUBLESHOOTING

### **Issue: Script Won't Run (Windows)**

**Error:** `execution of scripts is disabled on this system`

**Solution:**
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run script
.\build-production.ps1
```

### **Issue: Script Won't Run (Mac/Linux)**

**Error:** `Permission denied`

**Solution:**
```bash
chmod +x build-production.sh
./build-production.sh
```

### **Issue: npm Install Fails**

**Error:** `npm ERR! code EACCES` or permission errors

**Solution:**
```bash
# Windows (run as Administrator)
npm cache clean --force
npm install

# Mac/Linux
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
npm install
```

### **Issue: EAS Build Fails**

**Error:** `Not logged in` or `Authentication required`

**Solution:**
```bash
eas login
# Then run script again
.\build-production.ps1
```

### **Issue: Build Takes Too Long**

**Normal Time:** 15-25 minutes

**If taking >30 minutes:**
- Check internet connection
- Check EAS dashboard for build status
- Check if EAS servers are down: https://status.expo.dev/

---

## ✅ BEST PRACTICES

### **Before Running Build:**
1. ✅ Test app thoroughly in development
2. ✅ Remove all `console.log` statements (optional)
3. ✅ Update version number
4. ✅ Commit code to Git
5. ✅ Close all terminal windows

### **After Build Completes:**
1. ✅ Download .aab from EAS dashboard
2. ✅ Test .aab on fresh device install
3. ✅ Clear app data and test again
4. ✅ Upload to Play Console
5. ✅ Submit for review

### **Version Numbering:**
```
version: "1.0.0"  # Initial release
version: "1.0.1"  # Bug fix
version: "1.1.0"  # New feature
version: "2.0.0"  # Major update

versionCode: 1    # Android only, increment each build
versionCode: 2
versionCode: 3
```

---

## 📊 BUILD TIMELINE

| Step | Time | Notes |
|------|------|-------|
| Stop processes | 5 seconds | Quick |
| Clear caches | 10-30 seconds | Depends on cache size |
| Reinstall dependencies | 2-5 minutes | Depends on internet speed |
| Update version | 5 seconds | Quick |
| EAS Build | 15-25 minutes | Cloud build time |
| **Total** | **~20-30 minutes** | Most time is EAS build |

---

## 🎉 SUCCESS CHECKLIST

After build completes successfully:

- [ ] Script shows "✅ BUILD SUCCESSFUL!"
- [ ] Downloaded .aab from EAS dashboard
- [ ] Tested .aab on fresh device install
- [ ] App works on first launch (no cache issues)
- [ ] No crashes after clearing app data
- [ ] Uploaded to Play Console
- [ ] Submitted for review

---

## 📞 SUPPORT

### **If Build Fails:**

1. **Check error messages** in script output
2. **Check EAS dashboard** for build logs
3. **Check Expo status** page: https://status.expo.dev/
4. **Try manual build** commands (see above)
5. **Check documentation**: PRODUCTION-CRASH-FIX.md

### **Common Issues:**

| Issue | Solution |
|-------|----------|
| Script won't run | Check execution policy (Windows) or permissions (Mac/Linux) |
| npm install fails | Clear npm cache, run as admin |
| EAS build fails | Check authentication, internet, EAS credits |
| Build too slow | Normal (15-25 min), check internet |
| APK crashes | Clear all caches, rebuild with --clean |

---

## 🚀 QUICK START

### **Windows:**
```powershell
cd C:\Users\Administrator\restaurant-app\userapp
.\build-production.ps1
```

### **Mac/Linux:**
```bash
cd /path/to/restaurant-app/userapp
chmod +x build-production.sh
./build-production.sh
```

**That's it!** The script handles everything automatically! 🎉

---

## 📝 SCRIPT FILES

- **`build-production.ps1`** - Windows PowerShell script
- **`build-production.sh`** - Mac/Linux Bash script
- **`BUILD-README.md`** - This documentation file

**Location:** `userapp/` folder

---

**Happy Building!** 🍽️🚀
