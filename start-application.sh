# start-application.sh (Mac/Linux)
#!/bin/bash

echo "Starting Shopify Google Merchant Automation..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies"
        exit 1
    fi
fi

# Check if client dependencies are installed
if [ ! -d "client/node_modules" ]; then
    echo "Installing client dependencies..."
    npm run install-client
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install client dependencies"
        exit 1
    fi
fi

# Create necessary directories
mkdir -p data
mkdir -p exports

# Start the application
echo
echo "Starting application servers..."
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000 (development mode)"
echo
echo "The application will open in your default browser."
echo "Press Ctrl+C to stop the application."
echo

# Open browser (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3001"
# Open browser (Linux)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:3001" 2>/dev/null || echo "Please open http://localhost:3001 in your browser"
fi

npm run dev