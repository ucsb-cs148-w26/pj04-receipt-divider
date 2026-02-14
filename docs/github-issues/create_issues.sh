#!/bin/bash

# Script to create GitHub issues using GitHub CLI
# Requires: gh (GitHub CLI) to be installed and authenticated
# Usage: ./create_issues.sh

REPO="ucsb-cs148-w26/pj04-receipt-divider"
ISSUES_DIR="/tmp/github_issues"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Creating GitHub issues for Eezy Receipt...${NC}\n"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI.${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Function to extract title from markdown file
get_title() {
    head -1 "$1" | sed 's/# //'
}

# Function to extract body (everything after first line)
get_body() {
    tail -n +3 "$1"
}

# Function to extract labels from the markdown
get_labels() {
    grep "^\*\*Labels:\*\*" "$1" | sed 's/.*`\(.*\)`/\1/g' | tr ',' '\n' | sed 's/ //g' | paste -sd "," -
}

# Counter for created issues
count=0

# Loop through all markdown files except README
for file in "$ISSUES_DIR"/*.md; do
    # Skip README
    if [[ $(basename "$file") == "README.md" ]]; then
        continue
    fi
    
    echo -e "${BLUE}Processing: $(basename "$file")${NC}"
    
    title=$(get_title "$file")
    body=$(get_body "$file")
    
    # Create the issue
    if issue_url=$(gh issue create \
        --repo "$REPO" \
        --title "$title" \
        --body "$body" 2>&1); then
        
        count=$((count + 1))
        echo -e "${GREEN}✓ Created: $title${NC}"
        echo -e "  URL: $issue_url\n"
    else
        echo -e "${RED}✗ Failed to create: $title${NC}"
        echo -e "  Error: $issue_url\n"
    fi
    
    # Small delay to avoid rate limiting
    sleep 1
done

echo -e "\n${GREEN}Summary: Created $count issues${NC}"
echo -e "${BLUE}View all issues: https://github.com/$REPO/issues${NC}"
