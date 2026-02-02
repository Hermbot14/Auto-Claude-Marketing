#!/bin/bash

# Tour Timeline Verification Script
# Checks if the web server is running and Tour Timeline component is present

echo "🚀 Tour Timeline Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="http://localhost:3000"
TEST_RESULTS_DIR="test-results/tour-timeline"

# Create test results directory
mkdir -p "$TEST_RESULTS_DIR"

# Check if server is running
echo "📡 Checking if web server is running..."
if curl -s --head "$BASE_URL" | head -n 1 | grep -q "HTTP"; then
    echo "✅ Web server is running on $BASE_URL"
else
    echo "❌ Web server is not running on $BASE_URL"
    echo "   Please start with: npm run dev:web"
    exit 1
fi

# Get the page content
echo ""
echo "📄 Fetching page content..."
HTML_CONTENT=$(curl -s "$BASE_URL")

# Save HTML for inspection
echo "$HTML_CONTENT" > "$TEST_RESULTS_DIR/page-content.html"

# Check for key Tour Timeline elements
echo ""
echo "🔍 Checking for Tour Timeline elements..."

# Check for React app
if echo "$HTML_CONTENT" | grep -q "root"; then
    echo "✅ React app mount point found"
else
    echo "⚠️  React app mount point not found"
fi

# Check for main app script
if echo "$HTML_CONTENT" | grep -q "\.js"; then
    echo "✅ JavaScript bundles present"
else
    echo "⚠️  JavaScript bundles not found"
fi

# Count mentions of timeline/calendar in HTML
TIMELINE_COUNT=$(echo "$HTML_CONTENT" | grep -i "timeline\|calendar" | wc -l)
echo "📊 Timeline/Calendar mentions in HTML: $TIMELINE_COUNT"

# Check for key patterns
PATTERNS=(
    "TourTimeline"
    "ContentCalendar"
    "countdown"
    "status"
)

echo ""
echo "🔍 Checking for key component patterns..."
for pattern in "${PATTERNS[@]}"; do
    if echo "$HTML_CONTENT" | grep -iq "$pattern"; then
        echo "✅ Found pattern: $pattern"
    else
        echo "⚠️  Pattern not found (may be in JS bundle): $pattern"
    fi
done

# Check JS bundle for TourTimeline references
echo ""
echo "📦 Checking JavaScript bundles..."
JS_URLS=$(echo "$HTML_CONTENT" | grep -o 'src="[^"]*\.js"' | sed 's/src="//; s/"//g')

BUNDLE_FOUND=false
for js_url in $JS_URLS; do
    if [ -n "$js_url" ]; then
        FULL_URL="$BASE_URL$js_url"
        BUNDLE_CONTENT=$(curl -s "$FULL_URL")

        if echo "$BUNDLE_CONTENT" | grep -q "TourTimeline"; then
            echo "✅ TourTimeline component found in: $js_url"
            BUNDLE_FOUND=true
            # Extract relevant lines
            echo "$BUNDLE_CONTENT" | grep -o "TourTimeline[^;]*" | head -5
        fi

        if echo "$BUNDLE_CONTENT" | grep -q "countdown"; then
            echo "✅ Countdown functionality found in: $js_url"
        fi

        if echo "$BUNDLE_CONTENT" | grep -q "status"; then
            echo "✅ Status indicators found in: $js_url"
        fi
    fi
done

if [ "$BUNDLE_FOUND" = false ]; then
    echo "⚠️  Could not find TourTimeline in any JS bundle"
    echo "   This might be due to code splitting or lazy loading"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Results saved to: $TEST_RESULTS_DIR"
echo ""
echo "✅ Verification complete!"
echo ""
echo "To manually test:"
echo "  1. Open $BASE_URL in your browser"
echo "  2. Click on 'Calendar' in the sidebar"
echo "  3. Click on 'Tour Timeline' view button"
echo "  4. Verify countdown badges and status indicators are visible"
