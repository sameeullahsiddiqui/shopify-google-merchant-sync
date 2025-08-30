import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    LinearProgress,
    Chip,
    Alert,
    Grid,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemSecondaryAction,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Switch,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    Sync as SyncIcon,
    History as HistoryIcon,
    Schedule as ScheduleIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
    PlayArrow as PlayIcon,
    Stop as StopIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    ExpandMore as ExpandMoreIcon,
    Timeline as TimelineIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Sync = ({ showNotification }) => {
    const [loading, setLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState({});
    const [recentLogs, setRecentLogs] = useState([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', title: '', message: '' });
    const [syncSettings, setSyncSettings] = useState({
        autoSync: true,
        syncTime: '02:00',
        enableWebhooks: false,
        notifyOnError: true
    });

    useEffect(() => {
        loadSyncData();
        const interval = setInterval(loadSyncStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const loadSyncData = async () => {
        setLoading(true);
        try {
            const [statusData, logsData] = await Promise.all([
                apiService.getSyncStatus(),
                apiService.getLogs(1, 10)
            ]);
            setSyncStatus(statusData);
            setRecentLogs(logsData.logs || []);
        } catch (error) {
            showNotification(`Error loading sync data: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadSyncStatus = async () => {
        try {
            const statusData = await apiService.getSyncStatus();
            setSyncStatus(statusData);
        } catch (error) {
            console.warn('Failed to update sync status:', error.message);
        }
    };

    const handleStartSync = (type) => {
        setConfirmDialog({
            open: true,
            type,
            title: `Start ${type === 'full' ? 'Full' : 'Incremental'} Sync`,
            message: type === 'full'
                ? 'This will sync all products from Shopify. This may take 15-20 minutes for large catalogs.'
                : 'This will sync only products that have changed since the last sync. Usually completes in 1-5 minutes.'
        });
    };

    const confirmStartSync = async () => {
        const type = confirmDialog.type;
        setConfirmDialog({ open: false, type: '', title: '', message: '' });

        try {
            setLoading(true);
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
        } finally {
            setLoading(false);
        }
    };

    const handleStopSync = async () => {
        try {
            showNotification('Sync stop requested', 'info');
        } catch (error) {
            showNotification(`Failed to stop sync: ${error.message}`, 'error');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };

    const getSyncStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed': return 'success';
            case 'running': return 'warning';
            case 'failed': return 'error';
            case 'canceled': return 'default';
            default: return 'default';
        }
    };

    const getSyncStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed': return <CheckCircleIcon />;
            case 'running': return <SyncIcon className="animate-spin" />;
            case 'failed': return <ErrorIcon />;
            case 'canceled': return <StopIcon />;
            default: return <ScheduleIcon />;
        }
    };

    const getLogSeverityIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed': return <CheckCircleIcon color="success" />;
            case 'failed': return <ErrorIcon color="error" />;
            case 'running': return <InfoIcon color="info" />;
            default: return <ScheduleIcon color="action" />;
        }
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            {/* Header */}
            {/* ... (same as before) */}

            {/* Sync Statistics */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Sync Statistics
                </Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Box textAlign="center">
                            <Typography variant="h4" color="info.main">
                                {syncStatus.lastSync?.duration_seconds ?
                                    formatDuration(syncStatus.lastSync.duration_seconds) : 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Last Duration
                            </Typography>
                        </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <Box textAlign="center">
                            <Chip
                                icon={getSyncStatusIcon(syncStatus.lastSync?.status)}
                                label={syncStatus.lastSync?.status || 'No sync yet'}
                                color={getSyncStatusColor(syncStatus.lastSync?.status)}
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Last Status
                            </Typography>
                        </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <Box textAlign="center">
                            <Typography variant="h4" color="primary">
                                {syncStatus.productStats?.totalProducts?.toLocaleString() || 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Total Products
                            </Typography>
                        </Box>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <Box textAlign="center">
                            <Typography variant="h4" color="success.main">
                                {formatDate(syncStatus.lastSync?.end_time) !== 'Never'
                                    ? formatDate(syncStatus.lastSync?.end_time)
                                    : 'Never'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Last Sync
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* Recent Sync History, Settings Dialog, Confirmation Dialog, Accordion */}
            {/* ... (same as before) */}
        </Box>
    );
};

export default Sync;
