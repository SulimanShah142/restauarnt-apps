#!/bin/bash

# ======================================
# Restaurant Apps - Clean Rebuild Script
# ======================================
# This script performs a complete clean rebuild of all three apps
# ======================================

# Colors
CYAN='\033[0;36m'
WHITE='\033[1;37m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${WHITE}  Restaurant Apps - Clean Rebuild${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}📁 Project Root: $PROJECT_ROOT${NC}"
echo ""

# Function to clean and rebuild an app
rebuild_app() {
    local APP_NAME=$1
    local APP_PATH=$2
    
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${WHITE}  Rebuilding: $APP_NAME${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    
    # Check if app directory exists
    if [ ! -d "$PROJECT_ROOT/$APP_PATH" ]; then
        echo -e "${RED}❌ Error: App directory not found: $APP_PATH${NC}"
        return 1
    fi
    
    cd "$PROJECT_ROOT/$APP_PATH" || exit 1
    
    # Step 1: Clean node_modules
    echo -e "${YELLOW}🧹 Cleaning node_modules...${NC}"
    if [ -d "node_modules" ]; then
        rm -rf node_modules
        echo -e "${GREEN}✅ node_modules cleaned${NC}"
    else
        echo -e "${GRAY}ℹ️  node_modules not found (already clean)${NC}"
    fi
    
    # Step 2: Clean .expo cache
    echo -e "${YELLOW}🧹 Cleaning .expo cache...${NC}"
    if [ -d ".expo" ]; then
        rm -rf .expo
        echo -e "${GREEN}✅ .expo cache cleaned${NC}"
    else
        echo -e "${GRAY}ℹ️  .expo not found (already clean)${NC}"
    fi
    
    # Step 3: Clean dist folder
    echo -e "${YELLOW}🧹 Cleaning dist folder...${NC}"
    if [ -d "dist" ]; then
        rm -rf dist
        echo -e "${GREEN}✅ dist folder cleaned${NC}"
    else
        echo -e "${GRAY}ℹ️  dist not found (already clean)${NC}"
    fi
    
    # Step 4: Clean Metro cache
    echo -e "${YELLOW}🧹 Cleaning Metro cache...${NC}"
    if [ -d ".metro-cache" ]; then
        rm -rf .metro-cache
        echo -e "${GREEN}✅ Metro cache cleaned${NC}"
    else
        echo -e "${GRAY}ℹ️  .metro-cache not found (already clean)${NC}"
    fi
    
    # Step 5: Check .env file
    echo -e "${YELLOW}🔐 Checking .env file...${NC}"
    if [ -f ".env" ]; then
        echo -e "${GREEN}✅ .env file found${NC}"
    else
        echo -e "${RED}⚠️  .env file not found! Please create it from .env.example${NC}"
    fi
    
    # Step 6: Check if pnpm is installed
    echo -e "${YELLOW}📦 Checking pnpm...${NC}"
    if ! command -v pnpm &> /dev/null; then
        echo -e "${RED}❌ pnpm is not installed. Installing globally...${NC}"
        npm install -g pnpm
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Failed to install pnpm. Please install it manually.${NC}"
            cd "$PROJECT_ROOT" || exit 1
            return 1
        fi
    fi
    echo -e "${GREEN}✅ pnpm is installed${NC}"
    
    # Step 7: Install dependencies
    echo -e "${YELLOW}📦 Installing dependencies with pnpm...${NC}"
    echo ""
    pnpm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        cd "$PROJECT_ROOT" || exit 1
        return 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ $APP_NAME rebuild complete!${NC}"
    cd "$PROJECT_ROOT" || exit 1
    return 0
}

# Main execution
START_TIME=$(date +%s)
echo -e "${CYAN}⏰ Started at: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

# Rebuild all three apps
APPS=(
    "📱 User App:userapp"
    "🚴 Delivery App:deliverapp"
    "👨‍💼 Admin App:admins-app"
)

SUCCESS_COUNT=0
FAIL_COUNT=0

for app_data in "${APPS[@]}"; do
    APP_NAME="${app_data%%:*}"
    APP_PATH="${app_data##*:}"
    
    rebuild_app "$APP_NAME" "$APP_PATH"
    
    if [ $? -eq 0 ]; then
        ((SUCCESS_COUNT++))
    else
        ((FAIL_COUNT++))
    fi
    
    # Small delay between apps
    sleep 2
done

# Summary
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${WHITE}  Rebuild Summary${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${CYAN}⏰ Started:  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${CYAN}⏰ Finished: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${CYAN}⏱️  Duration: ${MINUTES}m ${SECONDS}s${NC}"
echo ""
echo -e "${GREEN}✅ Successful: $SUCCESS_COUNT / ${#APPS[@]}${NC}"
if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${RED}❌ Failed: $FAIL_COUNT / ${#APPS[@]}${NC}"
fi
echo ""

if [ $SUCCESS_COUNT -eq ${#APPS[@]} ]; then
    echo -e "${GREEN}🎉 All apps rebuilt successfully!${NC}"
    echo ""
    echo -e "${YELLOW}🚀 Next steps:${NC}"
    echo -e "   ${WHITE}1. cd userapp && npx expo start${NC}"
    echo -e "   ${WHITE}2. cd deliverapp && npx expo start${NC}"
    echo -e "   ${WHITE}3. cd admins-app && npx expo start${NC}"
    echo ""
else
    echo -e "${RED}⚠️  Some apps failed to rebuild. Check the errors above.${NC}"
    echo ""
fi

echo -e "${CYAN}========================================${NC}"
echo ""

# Return to project root
cd "$PROJECT_ROOT" || exit 1
