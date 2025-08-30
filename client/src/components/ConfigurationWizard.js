import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Button,
    TextField,
    Alert,
    CircularProgress,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Link,
    Chip
} from '@mui/material';
import {
    Store as StoreIcon,
    Security as SecurityIcon,
    CheckCircle as CheckCircleIcon,
    Launch as LaunchIcon,
    Key as KeyIcon,
    Settings as SettingsIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const ConfigurationWizard = ({ onComplete }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState({ success: false, message: '' });
    const [config, setConfig] = useState({
        shopUrl: 'samee.myshopify.com',
        accessToken: ''
    });

    const steps = [
        {
            label: 'Welcome',
            description: 'Get started with Shopify automation'
        },
        {
            label: 'Shopify Connection',
            description: 'Connect your Shopify store'
        },
        {
            label: 'Test Connection',
            description: 'Verify your configuration'
        },
        {
            label: 'Complete Setup',
            description: 'Finish the initial setup'
        }
    ];

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleTestConnection = async () => {
        setLoading(true);
        try {
            const result = await apiService.testConnection(config.shopUrl, config.accessToken);
            setConnectionStatus(result);

            if (result.success) {
                // Save configuration if test successful
                await apiService.saveConfig(config);
                handleNext();
            }
        } catch (error) {
            setConnectionStatus({
                success: false,
                message: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFinishSetup = async () => {
        setLoading(true);
        try {
            // Perform initial sync or other setup tasks
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate setup time
            onComplete();
        } catch (error) {
            console.error('Setup completion failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderWelcomeStep = () => (
        <Box>
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <StoreIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                        <Box>
                            <Typography variant="h5" fontWeight="bold">
                                Welcome to Shopify Automation
                            </Typography>
                            <Typography color="text.secondary">
                                Automate your Google Merchant feeds in just a few steps
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            <Typography variant="h6" gutterBottom>
                What you'll accomplish:
            </Typography>

            <List>
                <ListItem>
                    <ListItemIcon>
                        <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Connect your Shopify store"
                        secondary="Securely link your store for product data access"
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon>
                        <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Automate Google Merchant feeds"
                        secondary="Generate compliant Excel feeds for 50,000+ products"
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon>
                        <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Set up daily sync"
                        secondary="Keep your product data automatically updated"
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon>
                        <CheckCircleIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Professional dashboard"
                        secondary="Monitor and manage your automation"
                    />
                </ListItem>
            </List>

            <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                    <strong>Time required:</strong> About 5 minutes to complete setup
                </Typography>
            </Alert>
        </Box>
    );

    const renderConnectionStep = () => (
        <Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body2">
                    You'll need admin access to your Shopify store to complete this step.
                </Typography>
            </Alert>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Step 1: Get your Store URL
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Your store URL is typically in the format: yourstore.myshopify.com
                    </Typography>
                    <TextField
                        fullWidth
                        label="Shopify Store URL"
                        value={config.shopUrl}
                        onChange={(e) => setConfig(prev => ({ ...prev, shopUrl: e.target.value }))}
                        placeholder="yourstore.myshopify.com"
                        helperText="Enter your complete Shopify domain"
                    />
                </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Step 2: Create Private App Access Token
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Follow these steps to create an API access token:
                    </Typography>

                    <List dense>
                        <ListItem>
                            <ListItemIcon>
                                <Chip label="1" size="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Go to your Shopify Admin → Settings → Apps and sales channels"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <Chip label="2" size="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Click 'Develop apps' → 'Create an app'"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <Chip label="3" size="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Configure Admin API access → Request access to:"
                                secondary="• Products: Read access • Inventory: Read access • Orders: Read access (optional)"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <Chip label="4" size="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText
                                primary="Install app → Reveal token and copy Admin API access token"
                            />
                        </ListItem>
                    </List>

                    <Box sx={{ mt: 2 }}>
                        <Link
                            href="https://help.shopify.com/en/manual/apps/private-apps"
                            target="_blank"
                            sx={{ display: 'inline-flex', alignItems: 'center' }}
                        >
                            Detailed Shopify Instructions <LaunchIcon fontSize="small" sx={{ ml: 0.5 }} />
                        </Link>
                    </Box>
                </CardContent>
            </Card>

            <TextField
                fullWidth
                label="Admin API Access Token"
                type="password"
                value={config.accessToken}
                onChange={(e) => setConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                helperText="Paste your Admin API access token here"
                InputProps={{
                    startAdornment: <KeyIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
            />

            <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                    <SecurityIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    Your credentials are encrypted and stored securely
                </Typography>
            </Alert>
        </Box>
    );

    const renderTestStep = () => (
        <Box>
            <Typography variant="h6" gutterBottom>
                Test Your Shopify Connection
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                We'll verify that your configuration is correct and we can access your store data.
            </Typography>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                        Configuration Summary:
                    </Typography>
                    <List dense>
                        <ListItem>
                            <ListItemIcon>
                                <StoreIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary="Store URL"
                                secondary={config.shopUrl}
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <KeyIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary="Access Token"
                                secondary={`${config.accessToken.substring(0, 10)}...`}
                            />
                        </ListItem>
                    </List>
                </CardContent>
            </Card>

            {connectionStatus.message && (
                <Alert
                    severity={connectionStatus.success ? 'success' : 'error'}
                    sx={{ mb: 3 }}
                >
                    <Typography variant="body2">
                        {connectionStatus.message}
                    </Typography>
                    {connectionStatus.success && connectionStatus.shop && (
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="body2">
                                <strong>Store Name:</strong> {connectionStatus.shop.name}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Domain:</strong> {connectionStatus.shop.domain}
                            </Typography>
                        </Box>
                    )}
                </Alert>
            )}

            <Button
                variant="contained"
                onClick={handleTestConnection}
                disabled={!config.shopUrl || !config.accessToken || loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SettingsIcon />}
                fullWidth
                size="large"
            >
                {loading ? 'Testing Connection...' : 'Test Connection'}
            </Button>

            {!connectionStatus.success && connectionStatus.message && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                        <strong>Common Issues:</strong>
                    </Typography>
                    <List dense>
                        <ListItem>
                            <ListItemText
                                primary="• Check that your store URL is correct (include .myshopify.com)"
                                primaryTypographyProps={{ variant: 'body2' }}
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemText
                                primary="• Verify your API access token is complete and correct"
                                primaryTypographyProps={{ variant: 'body2' }}
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemText
                                primary="• Ensure your private app has the required permissions"
                                primaryTypographyProps={{ variant: 'body2' }}
                            />
                        </ListItem>
                    </List>
                </Alert>
            )}
        </Box>
    );

    const renderCompleteStep = () => (
        <Box>
            <Card sx={{ mb: 3, backgroundColor: 'success.50' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                    <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight="bold" gutterBottom>
                        Setup Complete!
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Your Shopify store is successfully connected and ready for automation.
                    </Typography>
                </CardContent>
            </Card>

            <Typography variant="h6" gutterBottom>
                What happens next:
            </Typography>

            <List>
                <ListItem>
                    <ListItemIcon>
                        <Chip label="1" size="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Access your dashboard"
                        secondary="Monitor your products and sync status"
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon>
                        <Chip label="2" size="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Run your first sync"
                        secondary="Import all your products (takes 15-20 minutes for 50k products)"
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon>
                        <Chip label="3" size="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Generate your first Google Merchant feed"
                        secondary="Create Excel exports ready for Google Merchant Center"
                    />
                </ListItem>
                <ListItem>
                    <ListItemIcon>
                        <Chip label="4" size="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Set up automated daily syncs"
                        secondary="Keep your data current with automatic updates"
                    />
                </ListItem>
            </List>

            <Alert severity="success" sx={{ mt: 3 }}>
                <Typography variant="body2">
                    <strong>Ready to go!</strong> Click "Finish Setup" to start using your Shopify automation system.
                </Typography>
            </Alert>

            <Button
                variant="contained"
                onClick={handleFinishSetup}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <LaunchIcon />}
                fullWidth
                size="large"
                sx={{ mt: 2 }}
            >
                {loading ? 'Completing Setup...' : 'Finish Setup & Start Using'}
            </Button>
        </Box>
    );

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return renderWelcomeStep();
            case 1:
                return renderConnectionStep();
            case 2:
                return renderTestStep();
            case 3:
                return renderCompleteStep();
            default:
                return 'Unknown step';
        }
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" component="h1" fontWeight="bold" sx={{ mb: 1 }}>
                    Setup Wizard
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Let's get your Shopify automation system configured and ready to use.
                </Typography>

                <Stepper activeStep={activeStep} orientation="vertical">
                    {steps.map((step, index) => (
                        <Step key={step.label}>
                            <StepLabel>
                                <Typography variant="h6">{step.label}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {step.description}
                                </Typography>
                            </StepLabel>
                            <StepContent>
                                <Box sx={{ mb: 2 }}>
                                    {renderStepContent(index)}
                                </Box>
                                <Box sx={{ mb: 1 }}>
                                    {index < steps.length - 1 && (
                                        <>
                                            <Button
                                                variant="contained"
                                                onClick={handleNext}
                                                sx={{ mt: 1, mr: 1 }}
                                                disabled={
                                                    (index === 1 && (!config.shopUrl || !config.accessToken)) ||
                                                    (index === 2 && !connectionStatus.success) ||
                                                    loading
                                                }
                                            >
                                                {index === steps.length - 1 ? 'Finish' : 'Continue'}
                                            </Button>
                                            <Button
                                                disabled={index === 0}
                                                onClick={handleBack}
                                                sx={{ mt: 1, mr: 1 }}
                                            >
                                                Back
                                            </Button>
                                        </>
                                    )}
                                </Box>
                            </StepContent>
                        </Step>
                    ))}
                </Stepper>
            </Paper>
        </Box>
    );
};

export default ConfigurationWizard;