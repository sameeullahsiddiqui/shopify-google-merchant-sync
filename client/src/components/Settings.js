import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Card,
    CardContent,
    CardActions,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Alert,
    Divider,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Chip
} from '@mui/material';
import {
    Save as SaveIcon,
    Refresh as RefreshIcon,
    Security as SecurityIcon,
    Schedule as ScheduleIcon,
    Notifications as NotificationsIcon,
    Storage as StorageIcon,
    CloudUpload as CloudUploadIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Settings = ({ showNotification }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showTokens, setShowTokens] = useState(false);
    const [testConnectionDialog, setTestConnectionDialog] = useState(false);
    const [connectionResult, setConnectionResult] = useState(null);

    const [settings, setSettings] = useState({
        // Shopify Configuration
        shopUrl: '',
        accessToken: '',

        // Sync Settings
        autoSync: true,
        syncInterval: 'daily',
        syncTime: '02:00',
        enableWebhooks: false,
        batchSize: 250,

        // Export Settings
        defaultCurrency: 'USD',
        includeOutOfStock: false,
        includeUnpublished: false,
        imageSize: 'master',

        // Notification Settings
        emailNotifications: false,
        email: '',
        notifyOnSuccess: false,
        notifyOnError: true,

        // Advanced Settings
        rateLimitDelay: 500,
        maxRetries: 3,
        enableLogging: true,
        logLevel: 'info',
        autoCleanup: true,
        cleanupDays: 30
    });

    const [originalSettings, setOriginalSettings] = useState({});
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        // Check if settings have changed
        const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
        setHasChanges(changed);
    }, [settings, originalSettings]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const config = await apiService.getConfig();
            setSettings(config);
            setOriginalSettings(config);
        } catch (error) {
            showNotification(`Error loading settings: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await apiService.saveConfig(settings);
            setOriginalSettings({ ...settings });
            setHasChanges(false);
            showNotification('Settings saved successfully', 'success');
        } catch (error) {
            showNotification(`Error saving settings: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleResetSettings = () => {
        setSettings({ ...originalSettings });
        setHasChanges(false);
    };

    const handleTestConnection = async () => {
        setLoading(true);
        try {
            const result = await apiService.testConnection(settings.shopUrl, settings.accessToken);
            setConnectionResult(result);
            setTestConnectionDialog(true);

            if (result.success) {
                showNotification('Connection test successful', 'success');
            } else {
                showNotification('Connection test failed', 'error');
            }
        } catch (error) {
            setConnectionResult({
                success: false,
                message: error.message
            });
            setTestConnectionDialog(true);
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = (section, key, value) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const handleDirectChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    Settings
                </Typography>
                <Box>
                    <Tooltip title="Refresh Settings">
                        <IconButton onClick={loadSettings} disabled={loading} sx={{ mr: 1 }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    {hasChanges && (
                        <Button
                            variant="outlined"
                            onClick={handleResetSettings}
                            sx={{ mr: 1 }}
                        >
                            Reset Changes
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSaveSettings}
                        disabled={!hasChanges || saving}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </Box>
            </Box>

            {/* Unsaved Changes Alert */}
            {hasChanges && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    You have unsaved changes. Don't forget to save your settings.
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Shopify Configuration */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <SecurityIcon sx={{ mr: 2, color: 'primary.main' }} />
                                <Typography variant="h6">Shopify Configuration</Typography>
                            </Box>

                            <TextField
                                fullWidth
                                label="Store URL"
                                value={settings.shopUrl}
                                onChange={(e) => handleDirectChange('shopUrl', e.target.value)}
                                helperText="Your Shopify store domain (e.g., yourstore.myshopify.com)"
                                sx={{ mb: 2 }}
                            />

                            <TextField
                                fullWidth
                                label="Access Token"
                                type={showTokens ? 'text' : 'password'}
                                value={settings.accessToken}
                                onChange={(e) => handleDirectChange('accessToken', e.target.value)}
                                helperText="Admin API access token from your private app"
                                InputProps={{
                                    endAdornment: (
                                        <IconButton
                                            onClick={() => setShowTokens(!showTokens)}
                                            edge="end"
                                        >
                                            {showTokens ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                        </IconButton>
                                    ),
                                }}
                                sx={{ mb: 2 }}
                            />
                        </CardContent>
                        <CardActions>
                            <Button
                                startIcon={<CheckCircleIcon />}
                                onClick={handleTestConnection}
                                disabled={!settings.shopUrl || !settings.accessToken || loading}
                            >
                                Test Connection
                            </Button>
                        </CardActions>
                    </Card>
                </Grid>

                {/* Sync Settings */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <ScheduleIcon sx={{ mr: 2, color: 'success.main' }} />
                                <Typography variant="h6">Sync Settings</Typography>
                            </Box>

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.autoSync}
                                        onChange={(e) => handleDirectChange('autoSync', e.target.checked)}
                                    />
                                }
                                label="Enable Automatic Sync"
                                sx={{ mb: 2, display: 'block' }}
                            />

                            <FormControl fullWidth sx={{ mb: 2 }}>
                                <InputLabel>Sync Interval</InputLabel>
                                <Select
                                    value={settings.syncInterval}
                                    label="Sync Interval"
                                    onChange={(e) => handleDirectChange('syncInterval', e.target.value)}
                                >
                                    <MenuItem value="hourly">Hourly</MenuItem>
                                    <MenuItem value="daily">Daily</MenuItem>
                                    <MenuItem value="weekly">Weekly</MenuItem>
                                </Select>
                            </FormControl>

                            <TextField
                                fullWidth
                                label="Sync Time"
                                type="time"
                                value={settings.syncTime}
                                onChange={(e) => handleDirectChange('syncTime', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ mb: 2 }}
                            />

                            <TextField
                                fullWidth
                                label="Batch Size"
                                type="number"
                                value={settings.batchSize}
                                onChange={(e) => handleDirectChange('batchSize', parseInt(e.target.value))}
                                helperText="Products processed per batch (50-500)"
                                inputProps={{ min: 50, max: 500 }}
                            />
                        </CardContent>
                    </Card>
                </Grid>

                {/* Export Settings */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <CloudUploadIcon sx={{ mr: 2, color: 'info.main' }} />
                                <Typography variant="h6">Export Settings</Typography>
                            </Box>

                            <FormControl fullWidth sx={{ mb: 2 }}>
                                <InputLabel>Default Currency</InputLabel>
                                <Select
                                    value={settings.defaultCurrency}
                                    label="Default Currency"
                                    onChange={(e) => handleDirectChange('defaultCurrency', e.target.value)}
                                >
                                    <MenuItem value="USD">USD</MenuItem>
                                    <MenuItem value="EUR">EUR</MenuItem>
                                    <MenuItem value="GBP">GBP</MenuItem>
                                    <MenuItem value="CAD">CAD</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControl fullWidth sx={{ mb: 2 }}>
                                <InputLabel>Image Size</InputLabel>
                                <Select
                                    value={settings.imageSize}
                                    label="Image Size"
                                    onChange={(e) => handleDirectChange('imageSize', e.target.value)}
                                >
                                    <MenuItem value="master">Original Size</MenuItem>
                                    <MenuItem value="grande">Grande (600x600)</MenuItem>
                                    <MenuItem value="large">Large (480x480)</MenuItem>
                                    <MenuItem value="medium">Medium (240x240)</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.includeOutOfStock}
                                        onChange={(e) => handleDirectChange('includeOutOfStock', e.target.checked)}
                                    />
                                }
                                label="Include Out of Stock Products"
                                sx={{ mb: 1, display: 'block' }}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.includeUnpublished}
                                        onChange={(e) => handleDirectChange('includeUnpublished', e.target.checked)}
                                    />
                                }
                                label="Include Unpublished Products"
                                sx={{ display: 'block' }}
                            />
                        </CardContent>
                    </Card>
                </Grid>

                {/* Notification Settings */}
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <NotificationsIcon sx={{ mr: 2, color: 'warning.main' }} />
                                <Typography variant="h6">Notifications</Typography>
                            </Box>

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.emailNotifications}
                                        onChange={(e) => handleDirectChange('emailNotifications', e.target.checked)}
                                    />
                                }
                                label="Enable Email Notifications"
                                sx={{ mb: 2, display: 'block' }}
                            />

                            <TextField
                                fullWidth
                                label="Email Address"
                                type="email"
                                value={settings.email}
                                onChange={(e) => handleDirectChange('email', e.target.value)}
                                disabled={!settings.emailNotifications}
                                sx={{ mb: 2 }}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.notifyOnSuccess}
                                        onChange={(e) => handleDirectChange('notifyOnSuccess', e.target.checked)}
                                    />
                                }
                                label="Notify on Successful Sync"
                                disabled={!settings.emailNotifications}
                                sx={{ mb: 1, display: 'block' }}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.notifyOnError}
                                        onChange={(e) => handleDirectChange('notifyOnError', e.target.checked)}
                                    />
                                }
                                label="Notify on Sync Errors"
                                disabled={!settings.emailNotifications}
                                sx={{ display: 'block' }}
                            />
                        </CardContent>
                    </Card>
                </Grid>

                {/* Advanced Settings */}
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <StorageIcon sx={{ mr: 2, color: 'error.main' }} />
                                <Typography variant="h6">Advanced Settings</Typography>
                            </Box>

                            <Alert severity="warning" sx={{ mb: 3 }}>
                                <Typography variant="body2">
                                    <WarningIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                                    Changing these settings may affect system performance. Modify only if you understand the implications.
                                </Typography>
                            </Alert>

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={3}>
                                    <TextField
                                        fullWidth
                                        label="Rate Limit Delay (ms)"
                                        type="number"
                                        value={settings.rateLimitDelay}
                                        onChange={(e) => handleDirectChange('rateLimitDelay', parseInt(e.target.value))}
                                        helperText="Delay between API calls"
                                        inputProps={{ min: 200, max: 2000 }}
                                    />
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                    <TextField
                                        fullWidth
                                        label="Max Retries"
                                        type="number"
                                        value={settings.maxRetries}
                                        onChange={(e) => handleDirectChange('maxRetries', parseInt(e.target.value))}
                                        helperText="Failed request retries"
                                        inputProps={{ min: 1, max: 10 }}
                                    />
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                    <FormControl fullWidth>
                                        <InputLabel>Log Level</InputLabel>
                                        <Select
                                            value={settings.logLevel}
                                            label="Log Level"
                                            onChange={(e) => handleDirectChange('logLevel', e.target.value)}
                                        >
                                            <MenuItem value="error">Error Only</MenuItem>
                                            <MenuItem value="warn">Warning</MenuItem>
                                            <MenuItem value="info">Info</MenuItem>
                                            <MenuItem value="debug">Debug</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={6} md={3}>
                                    <TextField
                                        fullWidth
                                        label="Cleanup After (days)"
                                        type="number"
                                        value={settings.cleanupDays}
                                        onChange={(e) => handleDirectChange('cleanupDays', parseInt(e.target.value))}
                                        helperText="Auto-delete old logs"
                                        inputProps={{ min: 7, max: 365 }}
                                    />
                                </Grid>
                            </Grid>

                            <Box sx={{ mt: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={settings.enableLogging}
                                            onChange={(e) => handleDirectChange('enableLogging', e.target.checked)}
                                        />
                                    }
                                    label="Enable System Logging"
                                    sx={{ mr: 3 }}
                                />

                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={settings.autoCleanup}
                                            onChange={(e) => handleDirectChange('autoCleanup', e.target.checked)}
                                        />
                                    }
                                    label="Auto Cleanup Old Data"
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* System Information */}
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                System Information
                            </Typography>

                            <List dense>
                                <ListItem>
                                    <ListItemIcon>
                                        <Chip label="Version" size="small" color="primary" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Application Version"
                                        secondary="1.0.0"
                                    />
                                </ListItem>

                                <ListItem>
                                    <ListItemIcon>
                                        <Chip label="Node.js" size="small" color="success" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Runtime Version"
                                        secondary={navigator.userAgent || 'Browser'}
                                    />
                                </ListItem>

                                <ListItem>
                                    <ListItemIcon>
                                        <Chip label="Database" size="small" color="info" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Database Type"
                                        secondary="SQLite 3"
                                    />
                                </ListItem>

                                <ListItem>
                                    <ListItemIcon>
                                        <Chip label="API" size="small" color="warning" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Shopify API Version"
                                        secondary="2023-10"
                                    />
                                </ListItem>
                            </List>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Test Connection Dialog */}
            <Dialog
                open={testConnectionDialog}
                onClose={() => setTestConnectionDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Connection Test Results
                </DialogTitle>
                <DialogContent>
                    {connectionResult && (
                        <Box>
                            <Alert
                                severity={connectionResult.success ? 'success' : 'error'}
                                sx={{ mb: 2 }}
                            >
                                <Typography variant="body2">
                                    {connectionResult.message}
                                </Typography>
                            </Alert>

                            {connectionResult.success && connectionResult.shop && (
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="subtitle1" gutterBottom>
                                            Store Information:
                                        </Typography>
                                        <List dense>
                                            <ListItem>
                                                <ListItemText
                                                    primary="Store Name"
                                                    secondary={connectionResult.shop.name}
                                                />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText
                                                    primary="Domain"
                                                    secondary={connectionResult.shop.domain}
                                                />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText
                                                    primary="Email"
                                                    secondary={connectionResult.shop.email}
                                                />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText
                                                    primary="Currency"
                                                    secondary={connectionResult.shop.currency}
                                                />
                                            </ListItem>
                                        </List>
                                    </CardContent>
                                </Card>
                            )}

                            {!connectionResult.success && (
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="subtitle1" gutterBottom color="error">
                                            Common Solutions:
                                        </Typography>
                                        <List dense>
                                            <ListItem>
                                                <ListItemText
                                                    primary="• Verify your store URL is correct"
                                                    primaryTypographyProps={{ variant: 'body2' }}
                                                />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText
                                                    primary="• Check that your access token is complete and valid"
                                                    primaryTypographyProps={{ variant: 'body2' }}
                                                />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText
                                                    primary="• Ensure your private app has the required permissions"
                                                    primaryTypographyProps={{ variant: 'body2' }}
                                                />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText
                                                    primary="• Try regenerating your access token"
                                                    primaryTypographyProps={{ variant: 'body2' }}
                                                />
                                            </ListItem>
                                        </List>
                                    </CardContent>
                                </Card>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTestConnectionDialog(false)}>
                        Close
                    </Button>
                    {connectionResult && !connectionResult.success && (
                        <Button
                            variant="contained"
                            onClick={() => {
                                setTestConnectionDialog(false);
                                handleTestConnection();
                            }}
                        >
                            Test Again
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Settings;