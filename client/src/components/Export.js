import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Card,
    CardContent,
    CardActions,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    LinearProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    FormControlLabel,
    Checkbox,
    Slider,
    Divider
} from '@mui/material';
import {
    FileDownload as DownloadIcon,
    FilterList as FilterIcon,
    Refresh as RefreshIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    Settings as SettingsIcon,
    ExpandMore as ExpandMoreIcon,
    CloudDownload as CloudDownloadIcon,
    Assignment as AssignmentIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Export = ({ showNotification }) => {
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [exportHistory, setExportHistory] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [productTypes, setProductTypes] = useState([]);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [filters, setFilters] = useState({
        vendor: '',
        productType: '',
        minPrice: '',
        maxPrice: '',
        includeOutOfStock: false,
        includeUnpublished: false,
        tags: ''
    });
    const [exportSettings, setExportSettings] = useState({
        format: 'xlsx',
        currency: 'USD',
        includeVariants: false,
        imageSize: 'master',
        customFields: []
    });

    useEffect(() => {
        loadExportData();
    }, []);

    const loadExportData = async () => {
        setLoading(true);
        try {
            // Load export history and metadata
            const [productsData] = await Promise.all([
                apiService.getProducts(1, 100, '') // Get sample for filters
            ]);

            // Extract unique values for filters
            const uniqueVendors = [...new Set(productsData.products?.map(p => p.vendor).filter(Boolean))];
            const uniqueTypes = [...new Set(productsData.products?.map(p => p.product_type).filter(Boolean))];

            setVendors(uniqueVendors);
            setProductTypes(uniqueTypes);

            // Mock export history (in real app, this would come from API)
            setExportHistory([
                {
                    id: 1,
                    filename: 'google_merchant_feed_2024-01-15_50247_products.xlsx',
                    created_at: '2024-01-15T10:30:00Z',
                    products_count: 50247,
                    file_size: 12500000,
                    status: 'completed',
                    filters: { vendor: '', productType: '', includeOutOfStock: false }
                },
                {
                    id: 2,
                    filename: 'google_merchant_feed_2024-01-14_48932_products.xlsx',
                    created_at: '2024-01-14T09:15:00Z',
                    products_count: 48932,
                    file_size: 11800000,
                    status: 'completed',
                    filters: { vendor: 'Brand A', productType: '', includeOutOfStock: false }
                }
            ]);
        } catch (error) {
            showNotification(`Error loading export data: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateExport = async () => {
        setGenerating(true);
        try {
            const result = await apiService.generateExcel(filters);
            showNotification(
                `Excel feed generated successfully! ${result.productsCount} products exported.`,
                'success'
            );

            // Add to history
            setExportHistory(prev => [{
                id: Date.now(),
                filename: result.filename,
                created_at: new Date().toISOString(),
                products_count: result.productsCount,
                file_size: result.fileSizeKB * 1024,
                status: 'completed',
                filters: { ...filters }
            }, ...prev]);

            setExportDialogOpen(false);
        } catch (error) {
            showNotification(`Export failed: ${error.message}`, 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownloadFile = async (filename) => {
        try {
            await apiService.downloadFile(filename);
            showNotification('Download started', 'success');
        } catch (error) {
            showNotification(`Download failed: ${error.message}`, 'error');
        }
    };

    const handleDeleteFile = async (fileId) => {
        try {
            // Implementation for file deletion would go here
            setExportHistory(prev => prev.filter(item => item.id !== fileId));
            showNotification('File deleted successfully', 'success');
        } catch (error) {
            showNotification(`Delete failed: ${error.message}`, 'error');
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    const getFilterSummary = (filterObj) => {
        const active = [];
        if (filterObj.vendor) active.push(`Vendor: ${filterObj.vendor}`);
        if (filterObj.productType) active.push(`Type: ${filterObj.productType}`);
        if (filterObj.includeOutOfStock) active.push('Include Out of Stock');
        return active.length > 0 ? active.join(', ') : 'No filters';
    };

    const resetFilters = () => {
        setFilters({
            vendor: '',
            productType: '',
            minPrice: '',
            maxPrice: '',
            includeOutOfStock: false,
            includeUnpublished: false,
            tags: ''
        });
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    Export Management
                </Typography>
                <Box>
                    <Tooltip title="Refresh Export History">
                        <IconButton onClick={loadExportData} disabled={loading} sx={{ mr: 1 }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={() => setExportDialogOpen(true)}
                        disabled={generating}
                    >
                        Generate New Export
                    </Button>
                </Box>
            </Box>

            {/* Quick Export Options */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <AssignmentIcon sx={{ mr: 2, color: 'primary.main' }} />
                                <Typography variant="h6">Complete Feed</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                Export all active products in Google Merchant format
                            </Typography>
                            <Chip label="~50,000 products" size="small" />
                        </CardContent>
                        <CardActions>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleGenerateExport}
                                disabled={generating}
                            >
                                {generating ? 'Generating...' : 'Generate Complete Feed'}
                            </Button>
                        </CardActions>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <FilterIcon sx={{ mr: 2, color: 'success.main' }} />
                                <Typography variant="h6">Filtered Export</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                Export products with custom filters applied
                            </Typography>
                            <Chip label="Customizable" size="small" />
                        </CardContent>
                        <CardActions>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={() => setExportDialogOpen(true)}
                            >
                                Configure & Export
                            </Button>
                        </CardActions>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <CloudDownloadIcon sx={{ mr: 2, color: 'info.main' }} />
                                <Typography variant="h6">Scheduled Export</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                Set up automated daily exports
                            </Typography>
                            <Chip label="Coming Soon" size="small" disabled />
                        </CardContent>
                        <CardActions>
                            <Button
                                fullWidth
                                variant="outlined"
                                disabled
                            >
                                Setup Schedule
                            </Button>
                        </CardActions>
                    </Card>
                </Grid>
            </Grid>

            {/* Export Progress */}
            {generating && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Box sx={{ width: '100%' }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                            Generating Excel Feed...
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                            Please wait while we process your products and generate the Google Merchant feed.
                        </Typography>
                        <LinearProgress />
                    </Box>
                </Alert>
            )}

            {/* Export History */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Export History
                </Typography>

                {exportHistory.length === 0 ? (
                    <Alert severity="info">
                        No exports yet. Generate your first Google Merchant feed to see history here.
                    </Alert>
                ) : (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Filename</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell align="right">Products</TableCell>
                                    <TableCell align="right">File Size</TableCell>
                                    <TableCell>Filters Applied</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {exportHistory.map((item) => (
                                    <TableRow key={item.id} hover>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="medium">
                                                {item.filename}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {formatDate(item.created_at)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2">
                                                {item.products_count?.toLocaleString()}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2">
                                                {formatFileSize(item.file_size)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                                                {getFilterSummary(item.filters)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={item.status}
                                                size="small"
                                                color={item.status === 'completed' ? 'success' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Download">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDownloadFile(item.filename)}
                                                    sx={{ mr: 1 }}
                                                >
                                                    <DownloadIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="View Details">
                                                <IconButton size="small" sx={{ mr: 1 }}>
                                                    <ViewIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteFile(item.id)}
                                                    color="error"
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            {/* Export Configuration Dialog */}
            <Dialog
                open={exportDialogOpen}
                onClose={() => setExportDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Configure Export</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        {/* Basic Filters */}
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                            Product Filters
                        </Typography>

                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Vendor</InputLabel>
                                    <Select
                                        value={filters.vendor}
                                        label="Vendor"
                                        onChange={(e) => setFilters(prev => ({ ...prev, vendor: e.target.value }))}
                                    >
                                        <MenuItem value="">All Vendors</MenuItem>
                                        {vendors.map(vendor => (
                                            <MenuItem key={vendor} value={vendor}>
                                                {vendor}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Product Type</InputLabel>
                                    <Select
                                        value={filters.productType}
                                        label="Product Type"
                                        onChange={(e) => setFilters(prev => ({ ...prev, productType: e.target.value }))}
                                    >
                                        <MenuItem value="">All Types</MenuItem>
                                        {productTypes.map(type => (
                                            <MenuItem key={type} value={type}>
                                                {type}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        {/* Price Range */}
                        <Typography variant="subtitle2" gutterBottom>
                            Price Range
                        </Typography>
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Min Price"
                                    type="number"
                                    value={filters.minPrice}
                                    onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                                    InputProps={{ startAdornment: '$' }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Max Price"
                                    type="number"
                                    value={filters.maxPrice}
                                    onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                                    InputProps={{ startAdornment: '$' }}
                                />
                            </Grid>
                        </Grid>

                        {/* Include Options */}
                        <Typography variant="subtitle2" gutterBottom>
                            Include Options
                        </Typography>
                        <Box sx={{ mb: 3 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={filters.includeOutOfStock}
                                        onChange={(e) => setFilters(prev => ({
                                            ...prev,
                                            includeOutOfStock: e.target.checked
                                        }))}
                                    />
                                }
                                label="Include out of stock products"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={filters.includeUnpublished}
                                        onChange={(e) => setFilters(prev => ({
                                            ...prev,
                                            includeUnpublished: e.target.checked
                                        }))}
                                    />
                                }
                                label="Include unpublished products"
                            />
                        </Box>

                        {/* Advanced Settings Accordion */}
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1">Advanced Export Settings</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth>
                                            <InputLabel>File Format</InputLabel>
                                            <Select
                                                value={exportSettings.format}
                                                label="File Format"
                                                onChange={(e) => setExportSettings(prev => ({
                                                    ...prev,
                                                    format: e.target.value
                                                }))}
                                            >
                                                <MenuItem value="xlsx">Excel (.xlsx)</MenuItem>
                                                <MenuItem value="csv">CSV (.csv)</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth>
                                            <InputLabel>Currency</InputLabel>
                                            <Select
                                                value={exportSettings.currency}
                                                label="Currency"
                                                onChange={(e) => setExportSettings(prev => ({
                                                    ...prev,
                                                    currency: e.target.value
                                                }))}
                                            >
                                                <MenuItem value="USD">USD</MenuItem>
                                                <MenuItem value="EUR">EUR</MenuItem>
                                                <MenuItem value="GBP">GBP</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </AccordionDetails>
                        </Accordion>

                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button onClick={resetFilters} sx={{ mr: 1 }}>
                                Reset Filters
                            </Button>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExportDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleGenerateExport}
                        disabled={generating}
                        startIcon={generating ? <LinearProgress size={20} /> : <DownloadIcon />}
                    >
                        {generating ? 'Generating...' : 'Generate Export'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Export;