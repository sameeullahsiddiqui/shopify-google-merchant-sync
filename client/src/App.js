import React, { useState, useEffect } from 'react';
import {
    ThemeProvider,
    createTheme,
    CssBaseline,
    Box,
    AppBar,
    Toolbar,
    Typography,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    Alert,
    Snackbar,
    CircularProgress,
    Backdrop
} from '@mui/material';
import {
    Menu as MenuIcon,
    Dashboard as DashboardIcon,
    Inventory as ProductsIcon,
    Sync as SyncIcon,
    Settings as SettingsIcon,
    FileDownload as ExportIcon,
    Assessment as ReportsIcon,
    History as LogsIcon,
    Store as StoreIcon
} from '@mui/icons-material';
import { SnackbarProvider } from 'notistack';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// Import components
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Sync from './components/Sync';
import Settings from './components/Settings';
import Export from './components/Export';
import { Logs } from './components/Logs';
import { Reports } from './components/Reports';
import ConfigurationWizard from './components/ConfigurationWizard';

// Import services
import { apiService } from './services/apiService';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
        background: {
            default: '#f5f5f5',
        },
    },
    typography: {
        fontFamily: 'Roboto, Arial, sans-serif',
        h4: {
            fontWeight: 600,
        },
        h6: {
            fontWeight: 500,
        },
    },
    components: {
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#f8f9fa',
                    borderRight: '1px solid #e0e0e0',
                },
            },
        },
    },
});

const drawerWidth = 240;

const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Products', icon: <ProductsIcon />, path: '/products' },
    { text: 'Sync', icon: <SyncIcon />, path: '/sync' },
    { text: 'Export', icon: <ExportIcon />, path: '/export' },
    { text: 'Reports', icon: <ReportsIcon />, path: '/reports' },
    { text: 'Logs', icon: <LogsIcon />, path: '/logs' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

function App() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [currentPath, setCurrentPath] = useState('/dashboard');
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
    const [appStatus, setAppStatus] = useState({ configured: false, connected: false });
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        checkAppStatus();
        const interval = setInterval(checkAppStatus, 30000); // Check every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const checkAppStatus = async () => {
        try {
            const [statusResponse, configResponse] = await Promise.all([
                apiService.getStatus(),
                apiService.getConfig()
            ]);

            setAppStatus({
                configured: !!(configResponse.shopUrl && configResponse.accessToken),
                connected: statusResponse.database
            });

            // Show wizard if not configured
            if (!configResponse.shopUrl || !configResponse.accessToken) {
                setShowWizard(true);
            }
        } catch (error) {
            console.error('Error checking app status:', error);
            showNotification('Error checking application status', 'error');
        }
    };

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleNavigation = (path) => {
        setCurrentPath(path);
        setMobileOpen(false);
    };

    const showNotification = (message, severity = 'info') => {
        setNotification({ open: true, message, severity });
    };

    const hideNotification = () => {
        setNotification({ ...notification, open: false });
    };

    const handleWizardComplete = () => {
        setShowWizard(false);
        checkAppStatus();
        showNotification('Configuration completed successfully!', 'success');
    };

    const drawer = (
        <Box>
            <Toolbar>
                <Box display="flex" alignItems="center" gap={1}>
                    <StoreIcon color="primary" />
                    <Typography variant="h6" color="primary" fontWeight="bold">
                        Shopify Sync
                    </Typography>
                </Box>
            </Toolbar>

            <List>
                {menuItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                        <ListItemButton
                            selected={currentPath === item.path}
                            onClick={() => handleNavigation(item.path)}
                            sx={{
                                '&.Mui-selected': {
                                    backgroundColor: 'primary.main',
                                    color: 'white',
                                    '& .MuiListItemIcon-root': {
                                        color: 'white',
                                    },
                                },
                                '&.Mui-selected:hover': {
                                    backgroundColor: 'primary.dark',
                                },
                            }}
                        >
                            <ListItemIcon>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>

            {/* Status indicators */}
            <Box sx={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                <Alert
                    severity={appStatus.configured ? 'success' : 'warning'}
                    sx={{ mb: 1, fontSize: '0.75rem' }}
                >
                    {appStatus.configured ? 'Configured' : 'Not Configured'}
                </Alert>
                <Alert
                    severity={appStatus.connected ? 'success' : 'error'}
                    sx={{ fontSize: '0.75rem' }}
                >
                    {appStatus.connected ? 'Connected' : 'Disconnected'}
                </Alert>
            </Box>
        </Box>
    );

    const renderContent = () => {
        if (showWizard) {
            return <ConfigurationWizard onComplete={handleWizardComplete} />;
        }

        switch (currentPath) {
            case '/dashboard':
                return <Dashboard showNotification={showNotification} />;
            case '/products':
                return <Products showNotification={showNotification} />;
            case '/sync':
                return <Sync showNotification={showNotification} />;
            case '/export':
                return <Export showNotification={showNotification} />;
            case '/reports':
                return <Reports showNotification={showNotification} />;
            case '/logs':
                return <Logs showNotification={showNotification} />;
            case '/settings':
                return <Settings showNotification={showNotification} />;
            default:
                return <Dashboard showNotification={showNotification} />;
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <SnackbarProvider maxSnack={3}>
                <Box sx={{ display: 'flex' }}>
                    {/* AppBar */}
                    <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
                        <Toolbar>
                            <IconButton
                                color="inherit"
                                edge="start"
                                onClick={handleDrawerToggle}
                                sx={{ mr: 2, display: { sm: 'none' } }}
                            >
                                <MenuIcon />
                            </IconButton>
                            <Typography variant="h6" noWrap component="div">
                                Shopify Sync App
                            </Typography>
                        </Toolbar>
                    </AppBar>

                    {/* Drawer */}
                    <Box
                        component="nav"
                        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
                    >
                        {/* Mobile drawer */}
                        <Drawer
                            variant="temporary"
                            open={mobileOpen}
                            onClose={handleDrawerToggle}
                            ModalProps={{ keepMounted: true }}
                            sx={{
                                display: { xs: 'block', sm: 'none' },
                                '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                            }}
                        >
                            {drawer}
                        </Drawer>
                        {/* Desktop drawer */}
                        <Drawer
                            variant="permanent"
                            sx={{
                                display: { xs: 'none', sm: 'block' },
                                '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                            }}
                            open
                        >
                            {drawer}
                        </Drawer>
                    </Box>

                    {/* Main Content */}
                    <Box
                        component="main"
                        sx={{
                            flexGrow: 1,
                            p: 3,
                            width: { sm: `calc(100% - ${drawerWidth}px)` },
                        }}
                    >
                        <Toolbar />
                        {renderContent()}
                    </Box>
                </Box>

                {/* Notification Snackbar */}
                <Snackbar
                    open={notification.open}
                    autoHideDuration={4000}
                    onClose={hideNotification}
                >
                    <Alert onClose={hideNotification} severity={notification.severity} sx={{ width: '100%' }}>
                        {notification.message}
                    </Alert>
                </Snackbar>

                {/* Loading Backdrop */}
                <Backdrop sx={{ color: '#fff', zIndex: theme.zIndex.drawer + 1 }} open={loading}>
                    <CircularProgress color="inherit" />
                </Backdrop>
            </SnackbarProvider>
        </ThemeProvider>
    );
}

export default App;