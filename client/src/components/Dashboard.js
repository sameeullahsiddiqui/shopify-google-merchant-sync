import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Paper,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    LinearProgress,
    Chip,
    Alert,
    IconButton,
    Tooltip,
    Divider
} from '@mui/material';
import {
    Sync as SyncIcon,
    FileDownload as DownloadIcon,
    Refresh as RefreshIcon,
    TrendingUp as TrendingUpIcon,
    Store as StoreIcon,
    Schedule as ScheduleIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar
} from 'recharts';
import { apiService } from '../services/apiService';

const Dashboard = ({ showNotification }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({});
    const [syncStatus, setSyncStatus] = useState({});
    const [recentLogs, setRecentLogs] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadDashboardData();

        // Set up polling for real-time updates
        const interval = setInterval(loadSyncStatus, 5000);

        return () => clearInterval(interval);
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [statsData, syncData, logsData] = await Promise.all([
                apiService.getProductStats(),
                apiService.getSyncStatus(),
                apiService.getLogs(1, 5)
            ]);

            setStats(statsData);
            setSyncStatus(syncData);
            setRecentLogs(logsData.logs || []);
        } catch (error) {
            showNotification(`Error loading dashboard: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadSyncStatus = async () => {
        try {
            const syncData = await apiService.getSyncStatus();
            setSyncStatus(syncData);
        } catch (error) {
            // Silent fail for status updates
            console.warn('Failed to update sync status:', error.message);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadDashboardData();
            showNotification('Dashboard refreshed successfully', 'success');
        } catch (error) {
            showNotification(`Refresh failed: ${error.message}`, 'error');
        } finally {
            setRefreshing(false);
        }
    };

    const handleStartSync = async (type = 'incremental') => {
        try {
            if (type === 'full') {
                await apiService.startFullSync();
                showNotification('Full sync started successfully', 'info');
            } else {
                await apiService.startIncrementalSync();
                showNotification('Incremental sync started successfully', 'info');
            }
            loadSyncStatus();
        } catch (error) {
            showNotification(`Failed to start sync: ${error.message}`, 'error');
        }
    };

    const handleGenerateExcel = async () => {
        try {
            setLoading(true);
            const result = await apiService.generateExcel();
            showNotification(`Excel generated successfully: ${result.filename}`, 'success');
        } catch (error) {
            showNotification(`Failed to generate Excel: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat().format(num || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    const getSyncStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed': return 'success';
            case 'running': return 'warning';
            case 'failed': return 'error';
            default: return 'default';
        }
    };

    const getSyncStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed': return <CheckCircleIcon />;
            case 'running': return <SyncIcon className="animate-spin" />;
            case 'failed': return <ErrorIcon />;
            default: return <ScheduleIcon />;
        }
    };

    // Sample data for charts (replace with real data)
    const syncHistoryData = [
        { date: '2024-01-01', products: 45000, time: 18 },
        { date: '2024-01-02', products: 46500, time: 16 },
        { date: '2024-01-03', products: 48000, time: 19 },
        { date: '2024-01-04', products: 49200, time: 17 },
        { date: '2024-01-05', products: 50247, time: 15 },
    ];

    const productStatusData = [
        { name: 'Active', value: stats.publishedProducts || 0, color: '#4caf50' },
        { name: 'Inactive', value: (stats.totalProducts || 0) - (stats.publishedProducts || 0), color: '#f44336' }
    ];

    if (loading && !refreshing) {
        return (
            <Box sx={{ width: '100%', mt: 2 }}>
                <LinearProgress />
                <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
                    Loading dashboard data...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ flexGrow: 1 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    Dashboard
                </Typography>
                <Box>
                    <Tooltip title="Refresh Dashboard">
                        <IconButton
                            onClick={handleRefresh}
                            disabled={refreshing}
                            sx={{ mr: 1 }}
                        >
                            <RefreshIcon className={refreshing ? 'animate-spin' : ''} />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<SyncIcon />}
                        onClick={() => handleStartSync('incremental')}
                        disabled={syncStatus.isRunning}
                        sx={{ mr: 1 }}
                    >
                        Sync Now
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleGenerateExcel}
                    >
                        Generate Feed
                    </Button>
                </Box>
            </Box>

            {/* Key Metrics Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <StoreIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" component="div">
                                    Total Products
                                </Typography>
                            </Box>
                            <Typography variant="h3" component="div" fontWeight="bold">
                                {formatNumber(stats.totalProducts)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Active: {formatNumber(stats.publishedProducts)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <TrendingUpIcon sx={{ mr: 1, color: 'success.main' }} />
                                <Typography variant="h6" component="div">
                                    Avg Price
                                </Typography>
                            </Box>
                            <Typography variant="h3" component="div" fontWeight="bold">
                                ${(stats.avgPrice || 0).toFixed(2)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Across all variants
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <ScheduleIcon sx={{ mr: 1, color: 'info.main' }} />
                                <Typography variant="h6" component="div">
                                    Last Sync
                                </Typography>
                            </Box>
                            <Typography variant="h6" component="div" fontWeight="bold">
                                {formatDate(stats.lastSyncTime)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {stats.lastSyncTime ? 'Completed' : 'No sync yet'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Box sx={{ mr: 1 }}>{getSyncStatusIcon(syncStatus.currentSync?.status)}</Box>
                                <Typography variant="h6" component="div">
                                    Sync Status
                                </Typography>
                            </Box>
                            <Chip
                                label={syncStatus.isRunning ? 'Running' : 'Idle'}
                                color={syncStatus.isRunning ? 'warning' : 'success'}
                                sx={{ mb: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                                {syncStatus.currentSync?.products_processed || 0} products processed
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Sync Progress */}
            {syncStatus.isRunning && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                        Sync in Progress
                    </Typography>
                    <Typography variant="body2">
                        {syncStatus.currentSync?.sync_type === 'full' ? 'Full' : 'Incremental'} sync running...
                    </Typography>
                    <LinearProgress sx={{ mt: 1 }} />
                    <Typography variant="caption">
                        Processed: {syncStatus.currentSync?.products_processed || 0} products
                    </Typography>
                </Alert>
            )}

            {/* Charts Row */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                {/* Sync History Chart */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Sync Performance History
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={syncHistoryData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <RechartsTooltip />
                                <Bar yAxisId="left" dataKey="products" fill="#8884d8" name="Products" />
                                <Line yAxisId="right" type="monotone" dataKey="time" stroke="#82ca9d" name="Sync Time (min)" />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                {/* Product Status Pie Chart */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Product Status
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={productStatusData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, value }) => `${name}: ${formatNumber(value)}`}
                                >
                                    {productStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>

            {/* Recent Activity */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Recent Sync Logs
                        </Typography>
                        {recentLogs.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                No sync logs available yet.
                            </Typography>
                        ) : (
                            <Box>
                                {recentLogs.map((log, index) => (
                                    <Box key={log.id || index} sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            <Chip
                                                icon={getSyncStatusIcon(log.status)}
                                                label={log.sync_type || 'Unknown'}
                                                color={getSyncStatusColor(log.status)}
                                                size="small"
                                                sx={{ mr: 1 }}
                                            />
                                            <Typography variant="body2" color="text.secondary">
                                                {formatDate(log.created_at)}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2">
                                            Processed {formatNumber(log.products_processed || 0)} products
                                            {log.duration_seconds && ` in ${log.duration_seconds}s`}
                                        </Typography>
                                        {index < recentLogs.length - 1 && <Divider sx={{ mt: 2 }} />}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Quick Actions
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        Full Product Sync
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Sync all products from Shopify (takes 15-20 minutes)
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() => handleStartSync('full')}
                                        disabled={syncStatus.isRunning}
                                    >
                                        Start Full Sync
                                    </Button>
                                </CardActions>
                            </Card>

                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        Generate Excel Feed
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Create Google Merchant Center compliant Excel file
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={handleGenerateExcel}
                                    >
                                        Generate Now
                                    </Button>
                                </CardActions>
                            </Card>

                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        System Status
                                    </Typography>
                                    <Box sx={{ mt: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} fontSize="small" />
                                            <Typography variant="body2">Database Connected</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                            <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} fontSize="small" />
                                            <Typography variant="body2">Shopify API Active</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <CheckCircleIcon sx={{ color: 'success.main', mr: 1 }} fontSize="small" />
                                            <Typography variant="body2">Excel Generator Ready</Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;