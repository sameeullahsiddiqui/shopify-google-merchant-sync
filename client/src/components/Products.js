import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Chip,
    Avatar,
    IconButton,
    Tooltip,
    InputAdornment,
    Grid,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    LinearProgress,
    Alert
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    Refresh as RefreshIcon,
    FileDownload as DownloadIcon,
    Visibility as ViewIcon,
    Edit as EditIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Products = ({ showNotification }) => {
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState({
        page: 0,
        limit: 25,
        total: 0,
        pages: 0
    });
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        vendor: '',
        productType: '',
        status: 'all'
    });
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [productTypes, setProductTypes] = useState([]);

    useEffect(() => {
        loadProducts();
    }, [pagination.page, pagination.limit, search]);

    useEffect(() => {
        const delayedSearch = setTimeout(() => {
            if (pagination.page === 0) {
                loadProducts();
            } else {
                setPagination(prev => ({ ...prev, page: 0 }));
            }
        }, 500);

        return () => clearTimeout(delayedSearch);
    }, [search]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const data = await apiService.getProducts(
                pagination.page + 1,
                pagination.limit,
                search
            );

            setProducts(data.products || []);
            setPagination(prev => ({
                ...prev,
                total: data.pagination?.total || 0,
                pages: data.pagination?.pages || 0
            }));

            // Extract unique vendors and product types for filters
            const uniqueVendors = [...new Set(data.products?.map(p => p.vendor).filter(Boolean))];
            const uniqueTypes = [...new Set(data.products?.map(p => p.product_type).filter(Boolean))];
            setVendors(uniqueVendors);
            setProductTypes(uniqueTypes);

        } catch (error) {
            showNotification(`Error loading products: ${error.message}`, 'error');
            setProducts([]);
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

    const handleSearchChange = (event) => {
        setSearch(event.target.value);
    };

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
    };

    const handleClearFilters = () => {
        setFilters({
            vendor: '',
            productType: '',
            status: 'all'
        });
        setSearch('');
    };

    const handleSelectProduct = (productId) => {
        setSelectedProducts(prev => {
            if (prev.includes(productId)) {
                return prev.filter(id => id !== productId);
            } else {
                return [...prev, productId];
            }
        });
    };

    const handleSelectAll = (event) => {
        if (event.target.checked) {
            setSelectedProducts(products.map(p => p.id));
        } else {
            setSelectedProducts([]);
        }
    };

    const handleExportSelected = async () => {
        if (selectedProducts.length === 0) {
            showNotification('Please select products to export', 'warning');
            return;
        }

        try {
            setLoading(true);
            const result = await apiService.generateExcel({
                selectedProducts
            });
            showNotification(`Excel generated for ${selectedProducts.length} products`, 'success');
            setSelectedProducts([]);
        } catch (error) {
            showNotification(`Export failed: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price) => {
        return price ? `$${parseFloat(price).toFixed(2)}` : 'N/A';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'success';
            case 'draft': return 'warning';
            case 'archived': return 'error';
            default: return 'default';
        }
    };

    const filteredProducts = products.filter(product => {
        if (filters.vendor && product.vendor !== filters.vendor) return false;
        if (filters.productType && product.product_type !== filters.productType) return false;
        if (filters.status !== 'all' && product.status !== filters.status) return false;
        return true;
    });

    return (
        <Box sx={{ flexGrow: 1 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    Products
                </Typography>
                <Box>
                    <Tooltip title="Refresh Products">
                        <IconButton onClick={loadProducts} disabled={loading} sx={{ mr: 1 }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleExportSelected}
                        disabled={selectedProducts.length === 0}
                    >
                        Export Selected ({selectedProducts.length})
                    </Button>
                </Box>
            </Box>

            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Products
                            </Typography>
                            <Typography variant="h4">
                                {pagination.total.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Filtered Results
                            </Typography>
                            <Typography variant="h4">
                                {filteredProducts.length.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Selected
                            </Typography>
                            <Typography variant="h4">
                                {selectedProducts.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Unique Vendors
                            </Typography>
                            <Typography variant="h4">
                                {vendors.length}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Search and Filters */}
            <Paper sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            label="Search Products"
                            value={search}
                            onChange={handleSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            placeholder="Search by title, vendor, or tags..."
                        />
                    </Grid>
                    <Grid item xs={12} sm={4} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Vendor</InputLabel>
                            <Select
                                value={filters.vendor}
                                label="Vendor"
                                onChange={(e) => handleFilterChange('vendor', e.target.value)}
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
                    <Grid item xs={12} sm={4} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Product Type</InputLabel>
                            <Select
                                value={filters.productType}
                                label="Product Type"
                                onChange={(e) => handleFilterChange('productType', e.target.value)}
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
                    <Grid item xs={12} sm={4} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={filters.status}
                                label="Status"
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                            >
                                <MenuItem value="all">All Status</MenuItem>
                                <MenuItem value="active">Active</MenuItem>
                                <MenuItem value="draft">Draft</MenuItem>
                                <MenuItem value="archived">Archived</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<ClearIcon />}
                            onClick={handleClearFilters}
                        >
                            Clear Filters
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Products Table */}
            <Paper>
                {loading && <LinearProgress />}

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={selectedProducts.length > 0 && selectedProducts.length < filteredProducts.length}
                                        checked={filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length}
                                        onChange={handleSelectAll}
                                    />
                                </TableCell>
                                <TableCell>Product</TableCell>
                                <TableCell>Vendor</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Price Range</TableCell>
                                <TableCell>Variants</TableCell>
                                <TableCell>Inventory</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Last Updated</TableCell>
                                <TableCell align="center">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} align="center">
                                        <Box sx={{ py: 3 }}>
                                            <Typography variant="h6" color="textSecondary">
                                                {loading ? 'Loading products...' : 'No products found'}
                                            </Typography>
                                            {!loading && (search || Object.values(filters).some(f => f && f !== 'all')) && (
                                                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                                    Try adjusting your search or filter criteria
                                                </Typography>
                                            )}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProducts.map((product) => (
                                    <TableRow
                                        key={product.id}
                                        hover
                                        selected={selectedProducts.includes(product.id)}
                                    >
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selectedProducts.includes(product.id)}
                                                onChange={() => handleSelectProduct(product.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <Avatar
                                                    src={product.image_src}
                                                    alt={product.title}
                                                    sx={{ width: 40, height: 40, mr: 2 }}
                                                >
                                                    {product.title?.charAt(0)}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="subtitle2" noWrap sx={{ maxWidth: 200 }}>
                                                        {product.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary">
                                                        ID: {product.shopify_id}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {product.vendor || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {product.product_type || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="body2">
                                                    {formatPrice(product.min_price)}
                                                    {product.max_price && product.min_price !== product.max_price &&
                                                        ` - ${formatPrice(product.max_price)}`
                                                    }
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={product.variant_count || 0}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {product.total_inventory?.toLocaleString() || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={product.status || 'Unknown'}
                                                size="small"
                                                color={getStatusColor(product.status)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {formatDate(product.updated_at)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="View Product">
                                                <IconButton size="small" sx={{ mr: 1 }}>
                                                    <ViewIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit Product">
                                                <IconButton size="small">
                                                    <EditIcon fontSize="small" />
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
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    component="div"
                    count={pagination.total}
                    rowsPerPage={pagination.limit}
                    page={pagination.page}
                    onPageChange={handlePageChange}
                    onRowsPerPageChange={handleRowsPerPageChange}
                />
            </Paper>

            {/* Selection Summary */}
            {selectedProducts.length > 0 && (
                <Paper sx={{ p: 2, mt: 2, backgroundColor: 'primary.50' }}>
                    <Alert severity="info">
                        <Typography variant="body2">
                            {selectedProducts.length} product(s) selected.
                            <Button
                                variant="text"
                                onClick={handleExportSelected}
                                sx={{ ml: 1 }}
                            >
                                Export Selected
                            </Button>
                            <Button
                                variant="text"
                                onClick={() => setSelectedProducts([])}
                                sx={{ ml: 1 }}
                            >
                                Clear Selection
                            </Button>
                        </Typography>
                    </Alert>
                </Paper>
            )}
        </Box>
    );
};

export default Products;