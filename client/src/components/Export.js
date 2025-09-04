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
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon
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
    Assignment as AssignmentIcon,
    Label as LabelIcon,
    TrendingUp as TrendingUpIcon,
    Inventory as InventoryIcon,
    Store as StoreIcon,
    CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Export = ({ showNotification }) => {
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [exportHistory, setExportHistory] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [productTypes, setProductTypes] = useState([]);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [customLabelsDialogOpen, setCustomLabelsDialogOpen] = useState(false);
    const [lastExportLabels, setLastExportLabels] = useState(null);
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

            // Store custom labels data for display
            if (result.customLabelsApplied) {
                setLastExportLabels(result.customLabelsApplied);
            }

            showNotification(
                `Excel feed generated successfully! ${result.productsCount} products exported with intelligent custom labels.`,
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
                filters: { ...filters },
                customLabelsApplied: result.customLabelsApplied
            }, ...prev]);

            setExportDialogOpen(false);

            // Show custom labels summary
            if (result.customLabelsApplied) {
                setCustomLabelsDialogOpen(true);
            }
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

    const renderCustomLabelsStats = (stats) => {
        if (!stats) return null;

        return (
            <Grid container spacing={2}>
                {/* Lowest Variant Status */}
                <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <LabelIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6">Lowest Variants (Custom Label 0)</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Products identified as lowest-priced variants within product groups
                            </Typography>
                            <List dense>
                                {Object.entries(stats.lowestVariants).map(([status, count]) => (
                                    <ListItem key={status}>
                                        <ListItemIcon>
                                            <Chip
                                                label={count}
                                                size="small"
                                                color={status === 'Lowest_Variant' ? 'success' : status.startsWith('Higher_Variant') ? 'warning' : 'info'}
                                            />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={status.replace(/_/g, ' ')}
                                            secondary={
                                                status === 'Lowest_Variant' ? 'Best price among variants - Priority bidding' :
                                                    status.startsWith('Higher_Variant') ? 'Higher priced than lowest variant' :
                                                        status === 'Single_Variant' ? 'Only one variant available' :
                                                            'Standalone product'
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Competitive Positions */}
                <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <TrendingUpIcon sx={{ mr: 1, color: 'success.main' }} />
                                <Typography variant="h6">Market Position (Custom Label 1)</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Competitive positioning for performance optimization
                            </Typography>
                            <List dense>
                                {Object.entries(stats.competitivePositions).map(([position, count]) => (
                                    <ListItem key={position}>
                                        <ListItemIcon>
                                            <Chip
                                                label={count}
                                                size="small"
                                                color={position.includes('Leader') ? 'success' : 'info'}
                                            />
                                        </ListItemIcon>
                                        <ListItemText primary={position.replace('_', ' ')} />
                                    </ListItem>
                                ))}
                            </List>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Inventory Levels */}
                <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <InventoryIcon sx={{ mr: 1, color: 'warning.main' }} />
                                <Typography variant="h6">Stock Levels (Custom Label 2)</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Inventory-based campaign optimization
                            </Typography>
                            <List dense>
                                {Object.entries(stats.inventoryLevels).map(([level, count]) => (
                                    <ListItem key={level}>
                                        <ListItemIcon>
                                            <Chip
                                                label={count}
                                                size="small"
                                                color={level.includes('Critical') ? 'error' : level.includes('Low') ? 'warning' : 'success'}
                                            />
                                        </ListItemIcon>
                                        <ListItemText primary={level.replace('_', ' ')} />
                                    </ListItem>
                                ))}
                            </List>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Vendor Categories */}
                <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <StoreIcon sx={{ mr: 1, color: 'info.main' }} />
                                <Typography variant="h6">Brand Categories (Custom Label 3)</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Vendor-based campaign segmentation
                            </Typography>
                            <List dense>
                                {Object.entries(stats.vendorCategories).map(([category, count]) => (
                                    <ListItem key={category}>
                                        <ListItemIcon>
                                            <Chip label={count} size="small" color="secondary" />
                                        </ListItemIcon>
                                        <ListItemText primary={category.replace(/_/g, ' ')} />
                                    </ListItem>
                                ))}
                            </List>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Seasonal Attributes */}
                <Grid item xs={12}>
                    <Card variant="outlined">
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <CalendarIcon sx={{ mr: 1, color: 'secondary.main' }} />
                                <Typography variant="h6">Seasonal & Special Attributes (Custom Label 4)</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Seasonal and promotional campaign targeting
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {Object.entries(stats.seasonalAttributes).map(([attribute, count]) => (
                                    <Chip
                                        key={attribute}
                                        label={`${attribute.replace('_', ' ')}: ${count}`}
                                        variant="outlined"
                                        color="secondary"
                                    />
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Usage Guide */}
                <Grid item xs={12}>
                    <Alert severity="success" sx={{ mt: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                            🎯 Campaign Strategy for Lowest Variants
                        </Typography>
                        <Typography variant="body2">
                            <strong>Lowest_Variant products:</strong> These are your price leaders within product groups.
                            Apply <strong>+25% bid boost</strong> and allocate premium budget for maximum visibility and conversions.
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Higher_Variant products:</strong> Consider reducing bids by the price difference percentage
                            or pause if conversion rates are significantly lower than the lowest variant.
                        </Typography>
                    </Alert>
                </Grid>
            </Grid>
        );
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    Export Management
                </Typography>
                <Box>
                    <Tooltip title="View Custom Labels Info">
                        <span>
                            <IconButton
                                onClick={() => setCustomLabelsDialogOpen(true)}
                                disabled={!lastExportLabels}
                                sx={{ mr: 1 }}
                            >
                                <LabelIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
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

            {/* Custom Labels Info Alert */}
            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                    🎯 Intelligent Custom Labels Feature
                </Typography>
                <Typography variant="body2">
                    Our system automatically generates 5 intelligent custom labels for each product to optimize your Google Merchant campaigns:
                    <strong> Price Tiers, Market Position, Stock Levels, Brand Categories, and Seasonal Attributes.</strong>
                </Typography>
            </Alert>

            {/* Quick Export Options */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <AssignmentIcon sx={{ mr: 2, color: 'primary.main' }} />
                                <Typography variant="h6">Smart Complete Feed</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                Export all active products with intelligent custom labels for campaign optimization
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip label="~50,000 products" size="small" />
                                <Chip label="5 Custom Labels" size="small" color="primary" />
                                <Chip label="Campaign Ready" size="small" color="success" />
                            </Box>
                        </CardContent>
                        <CardActions>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleGenerateExport}
                                disabled={generating}
                                startIcon={<LabelIcon />}
                            >
                                {generating ? 'Generating...' : 'Generate Smart Feed'}
                            </Button>
                        </CardActions>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <FilterIcon sx={{ mr: 2, color: 'success.main' }} />
                                <Typography variant="h6">Custom Filtered Export</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                Export selected products with advanced filtering and custom labels
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip label="Custom Filters" size="small" />
                                <Chip label="Smart Labels" size="small" color="primary" />
                            </Box>
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
                                <Typography variant="h6">Automated Smart Exports</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ mb: 2 }}>
                                Schedule daily exports with dynamic custom label optimization
                            </Typography>
                            <Chip label="Coming Soon" size="small" disabled />
                        </CardContent>
                        <CardActions>
                            <Button
                                fullWidth
                                variant="outlined"
                                disabled
                            >
                                Setup Automation
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
                            Generating Smart Google Merchant Feed...
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                            Processing products and applying intelligent custom labels for campaign optimization.
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
                        No exports yet. Generate your first smart Google Merchant feed with custom labels to see history here.
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
                                    <TableCell>Custom Labels</TableCell>
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
                                            {item.customLabelsApplied ? (
                                                <Chip
                                                    icon={<LabelIcon />}
                                                    label="Smart Labels"
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => {
                                                        setLastExportLabels(item.customLabelsApplied);
                                                        setCustomLabelsDialogOpen(true);
                                                    }}
                                                />
                                            ) : (
                                                <Chip label="Basic" size="small" />
                                            )}
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
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LabelIcon sx={{ mr: 1 }} />
                        Configure Smart Export
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2">
                                <strong>Smart Custom Labels:</strong> Our system will automatically generate 5 intelligent custom labels
                                for campaign optimization: Price Tiers, Market Position, Stock Levels, Brand Categories, and Seasonal Attributes.
                            </Typography>
                        </Alert>

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
                                    InputProps={{
                                        startAdornment: '$'
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Max Price"
                                    type="number"
                                    value={filters.maxPrice}
                                    onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                                    InputProps={{
                                        startAdornment: '$'
                                    }}
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
                                                <MenuItem value="xlsx">Excel (.xlsx) - Recommended</MenuItem>
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
                        startIcon={generating ? <LinearProgress size={20} /> : <LabelIcon />}
                    >
                        {generating ? 'Generating...' : 'Generate Smart Export'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Custom Labels Stats Dialog */}
            <Dialog
                open={customLabelsDialogOpen}
                onClose={() => setCustomLabelsDialogOpen(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LabelIcon sx={{ mr: 1, color: 'primary.main' }} />
                        Smart Custom Labels Applied
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Alert severity="success" sx={{ mb: 3 }}>
                        <Typography variant="body1">
                            <strong>Campaign Optimization Ready!</strong> Your Google Merchant feed now includes 5 intelligent custom labels
                            designed to maximize your Shopping and Performance Max campaign performance.
                        </Typography>
                    </Alert>

                    {lastExportLabels && renderCustomLabelsStats(lastExportLabels)}

                    <Box sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            How to Use These Custom Labels in Google Ads:
                        </Typography>
                        <List>
                            <ListItem>
                                <ListItemText
                                    primary="Performance Max Campaigns"
                                    secondary="Use price tiers and market position labels for asset group segmentation"
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemText
                                    primary="Shopping Campaigns"
                                    secondary="Create campaign subdivisions based on brand categories and seasonal attributes"
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemText
                                    primary="Inventory Management"
                                    secondary="Set up automated rules based on stock level labels"
                                />
                            </ListItem>
                            <ListItem>
                                <ListItemText
                                    primary="Bidding Strategies"
                                    secondary="Apply different bid adjustments for price leaders vs market rate products"
                                />
                            </ListItem>
                        </List>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCustomLabelsDialogOpen(false)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Export;