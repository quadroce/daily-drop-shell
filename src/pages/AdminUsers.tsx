import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Users, Search, Filter, UserPlus, Edit, Trash2, 
  RefreshCw, ChevronLeft, ChevronRight, Settings,
  Mail, Shield, Globe, Calendar, Eye, EyeOff, UserX
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { requireSession } from "@/lib/auth";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { HardDeleteDialog } from "@/components/admin/HardDeleteDialog";

interface User {
  id: string;
  email: string;
  display_name: string;
  username: string;
  first_name: string;
  last_name: string;
  subscription_tier: 'free' | 'premium' | 'sponsor' | 'corporate';
  role: 'user' | 'editor' | 'admin';
  language_prefs: string[];
  youtube_embed_pref: boolean;
  onboarding_completed: boolean;
  created_at: string;
  is_active: boolean;
  company_role: string;
}

interface Language {
  code: string;
  label: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    tier: "all",
    role: "all",
    active: "true",
    lang: "all",
    onboarding: "all",
    youtube: ""
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [sort, setSort] = useState("created_at");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [hardDeleteUser, setHardDeleteUser] = useState<User | null>(null);
  const [isHardDeleting, setIsHardDeleting] = useState(false);

  useEffect(() => {
    checkAccess();
    fetchLanguages();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchQuery, filters, sort]);

  const checkAccess = async () => {
    try {
      await requireSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['admin', 'superadmin', 'editor'].includes(profile.role)) {
        toast({
          title: "Access Denied",
          description: "You need admin/editor privileges to access this page.",
          variant: "destructive",
        });
        return;
      }
      
      setCurrentUserRole(profile.role);
    } catch (error) {
      console.error('Access check failed:', error);
      toast({
        title: "Authentication Error",
        description: "Please login as an admin to access this page.",
        variant: "destructive",
      });
    }
  };

  const fetchLanguages = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-api/languages');
      if (error) throw error;
      setLanguages(data || []);
    } catch (error) {
      console.error('Error fetching languages:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search: searchQuery,
        page: currentPage.toString(),
        pageSize: "20",
        sort: sort
      });

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") {
          params.append(key, value);
        }
      });

      const { data, error } = await supabase.functions.invoke('admin-api/users', {
        body: Object.fromEntries(params)
      });

      if (error) throw error;

      const response = data as UsersResponse;
      setUsers(response.users || []);
      setTotalUsers(response.total || 0);
      setTotalPages(response.totalPages || 1);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData: Partial<User>) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-api/users', {
        body: userData
      });

      if (error) throw error;

      toast({
        title: "User Created",
        description: `User ${userData.email} has been created and invited.`,
      });

      fetchUsers();
      setIsDrawerOpen(false);
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const handleUpdateUser = async (userId: string, userData: Partial<User>) => {
    try {
      const { data, error } = await supabase.functions.invoke(`admin-api/users/${userId}`, {
        body: userData
      });

      if (error) throw error;

      toast({
        title: "User Updated",
        description: "User has been updated successfully.",
      });

      fetchUsers();
      setIsDrawerOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const handleSoftDelete = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(`admin-api/users/${userId}`, {
        body: { action: 'delete' }
      });

      if (error) throw error;

      toast({
        title: "User Deactivated",
        description: "User has been deactivated successfully.",
      });

      fetchUsers();
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate user",
        variant: "destructive",
      });
    }
  };

  const handleHardDelete = async (userId: string, force: boolean) => {
    try {
      setIsHardDeleting(true);
      
      const { data, error } = await supabase.functions.invoke('admin-hard-delete-user', {
        method: 'DELETE',
        body: { user_id: userId, force }
      });

      if (error) {
        // Handle specific error cases
        if (error.message?.includes('requires_force')) {
          toast({
            title: "Force Required",
            description: "This sponsor/corporate user requires force deletion. Please check the force option.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "User Deleted",
        description: data.message || "User has been permanently deleted.",
      });

      // Remove user from local state
      setUsers(prev => prev.filter(u => u.id !== userId));
      setHardDeleteUser(null);

    } catch (error) {
      console.error('Error hard deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsHardDeleting(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      tier: "all",
      role: "all",
      active: "true",
      lang: "all",
      onboarding: "all",
      youtube: ""
    });
    setSearchQuery("");
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'premium': return 'default';
      case 'sponsor': return 'secondary';
      case 'corporate': return 'outline';
      default: return 'secondary';
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'editor': return 'default';
      default: return 'secondary';
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <div className="text-muted-foreground">Loading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>Users</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Users Management</h1>
          <p className="text-muted-foreground">Manage user accounts, roles, and permissions</p>
        </div>
        
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetTrigger asChild>
            <Button onClick={() => setEditingUser(null)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </SheetTrigger>
          <UserEditorDrawer 
            user={editingUser}
            languages={languages}
            currentUserRole={currentUserRole}
            onSave={editingUser ? 
              (userId: string, userData: Partial<User>) => handleUpdateUser(userId, userData) : 
              (userId: string, userData: Partial<User>) => handleCreateUser(userData)
            }
            onClose={() => {
              setIsDrawerOpen(false);
              setEditingUser(null);
            }}
          />
        </Sheet>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
          <CardDescription>Filter and search through users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            <Button variant="outline" onClick={resetFilters}>
              Reset
            </Button>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Select value={filters.tier} onValueChange={(value) => setFilters(f => ({ ...f, tier: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Subscription" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="sponsor">Sponsor</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.role} onValueChange={(value) => setFilters(f => ({ ...f, role: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.active} onValueChange={(value) => setFilters(f => ({ ...f, active: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.lang} onValueChange={(value) => setFilters(f => ({ ...f, lang: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.onboarding} onValueChange={(value) => setFilters(f => ({ ...f, onboarding: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Onboarding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Completed</SelectItem>
                <SelectItem value="false">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created (Newest)</SelectItem>
                <SelectItem value="-created_at">Created (Oldest)</SelectItem>
                <SelectItem value="email">Email A-Z</SelectItem>
                <SelectItem value="-email">Email Z-A</SelectItem>
                <SelectItem value="display_name">Name A-Z</SelectItem>
                <SelectItem value="-display_name">Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users ({totalUsers})</CardTitle>
              <CardDescription>
                Showing {users.length} of {totalUsers} users
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.length === users.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUsers(users.map(u => u.id));
                        } else {
                          setSelectedUsers([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>YT</TableHead>
                  <TableHead>Onboard</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUsers(prev => [...prev, user.id]);
                          } else {
                            setSelectedUsers(prev => prev.filter(id => id !== user.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.display_name || 'N/A'}</div>
                        {user.username && (
                          <div className="text-sm text-muted-foreground">@{user.username}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getTierBadgeVariant(user.subscription_tier)}>
                        {user.subscription_tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.language_prefs?.slice(0, 2).map((code) => {
                          const lang = languages.find(l => l.code === code);
                          return (
                            <Badge key={code} variant="outline" className="text-xs">
                              {lang?.label || code}
                            </Badge>
                          );
                        })}
                        {user.language_prefs?.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{user.language_prefs.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.youtube_embed_pref ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.onboarding_completed ? "default" : "secondary"}>
                        {user.onboarding_completed ? "Done" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "destructive"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Sheet open={isDrawerOpen && editingUser?.id === user.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditingUser(null);
                          }
                          setIsDrawerOpen(open);
                        }}>
                          <SheetTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
          <UserEditorDrawer 
            user={editingUser}
            languages={languages}
            currentUserRole={currentUserRole}
            onSave={(userId: string, userData: Partial<User>) => handleUpdateUser(userId, userData)}
            onClose={() => {
              setIsDrawerOpen(false);
              setEditingUser(null);
            }}
          />
                        </Sheet>
                        {user.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSoftDelete(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {currentUserRole === 'superadmin' && (
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setHardDeleteUser(user)}
                              className="text-destructive hover:text-destructive"
                              title="Hard Delete (Permanent)"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"  
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hard Delete Dialog */}
      {hardDeleteUser && (
        <HardDeleteDialog
          open={!!hardDeleteUser}
          onOpenChange={(open) => !open && setHardDeleteUser(null)}
          user={hardDeleteUser}
          onConfirm={handleHardDelete}
          isDeleting={isHardDeleting}
        />
      )}
    </div>
  );
};

// User Editor Drawer Component
const UserEditorDrawer = ({ 
  user, 
  languages, 
  currentUserRole,
  onSave, 
  onClose 
}: {
  user: User | null;
  languages: Language[];
  currentUserRole: string;
  onSave: (userId: string, userData: Partial<User>) => void;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState({
    email: "",
    display_name: "",
    username: "",
    first_name: "",
    last_name: "",
    company_role: "",
    subscription_tier: "free" as 'free' | 'premium' | 'sponsor' | 'corporate',
    role: "user" as 'user' | 'editor' | 'admin',
    language_prefs: [] as string[],
    youtube_embed_pref: true,
    onboarding_completed: false,
    is_active: true
  });

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || "",
        display_name: user.display_name || "",
        username: user.username || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        company_role: user.company_role || "",
        subscription_tier: user.subscription_tier,
        role: user.role,
        language_prefs: user.language_prefs || [],
        youtube_embed_pref: user.youtube_embed_pref,
        onboarding_completed: user.onboarding_completed,
        is_active: user.is_active
      });
    } else {
      // Reset for create mode
      setFormData({
        email: "",
        display_name: "",
        username: "",
        first_name: "",
        last_name: "",
        company_role: "",
        subscription_tier: "free" as 'free' | 'premium' | 'sponsor' | 'corporate',
        role: "user" as 'user' | 'editor' | 'admin',
        language_prefs: [],
        youtube_embed_pref: true,
        onboarding_completed: false,
        is_active: true
      });
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user) {
      onSave(user.id, formData);
    } else {
      onSave("", formData);
    }
  };

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  return (
    <SheetContent className="sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>
          {user ? `Edit User: ${user.email}` : "Create New User"}
        </SheetTitle>
        <SheetDescription>
          {user ? "Update user information and settings" : "Create a new user account and send invitation"}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="status">Status & Role</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                required
                disabled={!!user} // Can't edit email for existing users
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData(f => ({ ...f, display_name: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData(f => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData(f => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData(f => ({ ...f, username: e.target.value }))}
                placeholder="@username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_role">Company Role</Label>
              <Input
                id="company_role"
                value={formData.company_role}
                onChange={(e) => setFormData(f => ({ ...f, company_role: e.target.value }))}
                placeholder="e.g. Software Engineer"
              />
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscription_tier">Subscription Tier</Label>
              <Select 
                value={formData.subscription_tier} 
                onValueChange={(value: any) => setFormData(f => ({ ...f, subscription_tier: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="sponsor">Sponsor</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: any) => setFormData(f => ({ ...f, role: value }))}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {!isAdmin && (
                <p className="text-sm text-muted-foreground">
                  Only admins can change user roles
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(f => ({ ...f, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active Account</Label>
            </div>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <div className="space-y-2">
              <Label>Languages (max 3)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-2">
                {languages.map((lang) => (
                  <div key={lang.code} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${lang.code}`}
                      checked={formData.language_prefs.includes(lang.code)}
                      onCheckedChange={(checked) => {
                        if (checked && formData.language_prefs.length < 3) {
                          setFormData(f => ({ 
                            ...f, 
                            language_prefs: [...f.language_prefs, lang.code] 
                          }));
                        } else if (!checked) {
                          setFormData(f => ({ 
                            ...f, 
                            language_prefs: f.language_prefs.filter(code => code !== lang.code) 
                          }));
                        }
                      }}
                      disabled={!formData.language_prefs.includes(lang.code) && formData.language_prefs.length >= 3}
                    />
                    <Label htmlFor={`lang-${lang.code}`} className="text-sm">
                      {lang.label}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Selected: {formData.language_prefs.length}/3
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="youtube_embed_pref"
                checked={formData.youtube_embed_pref}
                onCheckedChange={(checked) => setFormData(f => ({ ...f, youtube_embed_pref: checked }))}
              />
              <Label htmlFor="youtube_embed_pref">Enable YouTube Embeds</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="onboarding_completed"
                checked={formData.onboarding_completed}
                onCheckedChange={(checked) => setFormData(f => ({ ...f, onboarding_completed: checked }))}
              />
              <Label htmlFor="onboarding_completed">Onboarding Completed</Label>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {user ? "Update User" : "Create User"}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
};

export default AdminUsers;