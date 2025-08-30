// Logs.js
import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Chip,
    IconButton,
    Tooltip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Card,
    CardContent,
    Alert,
    LinearProgress
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Download as DownloadIcon,
    FilterList as FilterIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Logs = ({ showNotification }) => {
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({
        page: 0,
        limit: 50,
        total: 0,
        pages: 0
    });
    const [filters, setFilters] = useState({
        level: 'all',
        type: 'all',
        dateRange: '7days'
    });

    useEffect(() => {
        loadLogs();
    }, [pagination.page, pagination.limit]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await apiService.getLogs(
                pagination.page + 1,
                pagination.limit
            );

            setLogs(data.logs || []);
            setPagination(prev => ({
                ...prev,
                total: data.pagination?.total || 0,
                pages: data.pagination?.pages || 0
            }));
        } catch (error) {
            showNotification(`Error loading logs: ${error.message}`, 'error');
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (event, newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleRowsPerPageChange = (event) => {
        const newLimit = parseInt(event.target.value, 10);
        setPagination(prev => ({
            ...prev,
            limit: newLimit,
            page: 0
        }));
    };

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed':
            case 'success':
                return <CheckCircleIcon color="success" />;
            case 'failed':
            case 'error':
                return <ErrorIcon color="error" />;
            case 'warning':
                return <WarningIcon color="warning" />;
            default:
                return <InfoIcon color="info" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed':
            case 'success':
                return 'success';
            case 'failed':
            case 'error':
                return 'error';
            case 'warning':
                return 'warning';
            default:
                return 'info';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    System Logs
                </Typography>
                <Box>
                    <Tooltip title="Refresh Logs">
                        <IconButton onClick={loadLogs} disabled={loading} sx={{ mr: 1 }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Export Logs">
                        <IconButton sx={{ mr: 1 }}>
                            <DownloadIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Log Level</InputLabel>
                            <Select
                                value={filters.level}
                                label="Log Level"
                                onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
                            >
                                <MenuItem value="all">All Levels</MenuItem>
                                <MenuItem value="error">Error</MenuItem>
                                <MenuItem value="warning">Warning</MenuItem>
                                <MenuItem value="info">Info</MenuItem>
                                <MenuItem value="debug">Debug</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Log Type</InputLabel>
                            <Select
                                value={filters.type}
                                label="Log Type"
                                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                            >
                                <MenuItem value="all">All Types</MenuItem>
                                <MenuItem value="sync">Sync</MenuItem>
                                <MenuItem value="export">Export</MenuItem>
                                <MenuItem value="api">API</MenuItem>
                                <MenuItem value="system">System</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Date Range</InputLabel>
                            <Select
                                value={filters.dateRange}
                                label="Date Range"
                                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                            >
                                <MenuItem value="1day">Last 24 Hours</MenuItem>
                                <MenuItem value="7days">Last 7 Days</MenuItem>
                                <MenuItem value="30days">Last 30 Days</MenuItem>
                                <MenuItem value="all">All Time</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Paper>
                {loading && <LinearProgress />}

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Status</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Timestamp</TableCell>
                                <TableCell>Duration</TableCell>
                                <TableCell>Products</TableCell>
                                <TableCell>Details</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center">
                                        <Box sx={{ py: 3 }}>
                                            <Typography variant="h6" color="textSecondary">
                                                {loading ? 'Loading logs...' : 'No logs found'}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id} hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                {getStatusIcon(log.status)}
                                                <Chip
                                                    label={log.status}
                                                    size="small"
                                                    color={getStatusColor(log.status)}
                                                    sx={{ ml: 1 }}
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {log.sync_type || 'System'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {formatDate(log.created_at)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {formatDuration(log.duration_seconds)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="body2">
                                                    Processed: {(log.products_processed || 0).toLocaleString()}
                                                </Typography>
                                                {log.products_added > 0 && (
                                                    <Typography variant="caption" color="success.main">
                                                        +{log.products_added} added
                                                    </Typography>
                                                )}
                                                {log.products_updated > 0 && (
                                                    <Typography variant="caption" color="info.main" sx={{ ml: 1 }}>
                                                        ~{log.products_updated} updated
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 300 }}>
                                            <Typography variant="body2" noWrap>
                                                {log.error_message || 'Operation completed successfully'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="View Details">
                                                <IconButton size="small">
                                                    <InfoIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    rowsPerPageOptions={[25, 50, 100]}
                    component="div"
                    count={pagination.total}
                    rowsPerPage={pagination.limit}
                    page={pagination.page}
                    onPageChange={handlePageChange}
                    onRowsPerPageChange={handleRowsPerPageChange}
                />
            </Paper>
        </Box>
    );
};

export { Logs };