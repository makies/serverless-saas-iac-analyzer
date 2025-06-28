!/bin/bash

echo "Setting up Serverless SaaS IaC Analyzer project with Node.js 22.x..."

# Check Node.js version
NODE_VERSION=$(node --version)
echo "Current Node.js version: $NODE_VERSION"

if [[ ! "$NODE_VERSION" =~ ^v22\. ]]; then
    echo "Warning: Node.js 22.x is recommended. Current version: $NODE_VERSION"
    echo "Please consider upgrading to Node.js 22.x"
fi

# Create project structure
echo "Creating project structure..."
mkdir -p {infrastructure/{lib,bin,test},backend/{shared,functions},frontend/src,scripts,docs,tests}

# Create CDK specific directories
mkdir -p infrastructure/lib/constructs
mkdir -p backend/functions/{tenant-validator,iac-analyzer,account-scanner,report-generator,admin-functions}

# Initialize package.json files
echo "Initializing package configurations..."

# Copy package.json templates (created above) to appropriate directories

# Initialize Git repository
git init
git add .
git commit -m "Initial project setup with Node.js 20.x and CDK v2"

# Setup Husky for pre-commit hooks
echo "Setting up Git hooks..."
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"

echo "Project structure created successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'npm install' to install dependencies"
echo "2. Configure AWS credentials (aws configure)"
echo "3. Bootstrap CDK: 'cd infrastructure && npx cdk bootstrap'"
echo "4. Update environment variables in .env files"
echo "5. Run 'npm run type-check' to verify TypeScript setup"
echo "6. Run 'npm run lint' to verify ESLint configuration"
echo "7. Run 'npm run test' to verify Jest setup"
echo ""
echo "Development ready with:"
echo "- Node.js 22.x runtime"
echo "- TypeScript 5.x"
echo "- AWS CDK v2"
echo "- ESLint with CDK plugin"
echo "- Jest v30 testing framework"
echo "- Prettier v3.x code formatting"
echo "- Husky pre-commit hooks"
