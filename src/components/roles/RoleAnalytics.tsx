import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Shield, AlertCircle } from 'lucide-react';

interface RoleUsage {
  role_name: string;
  user_count: number;
  is_default: boolean;
}

export function RoleAnalytics() {
  const { profile: currentUser } = useAuth();
  const [roleUsage, setRoleUsage] = useState<RoleUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    fetchRoleUsage();
  }, [currentUser?.company_id]);

  const fetchRoleUsage = async () => {
    if (!currentUser?.company_id) return;

    setLoading(true);
    try {
      const { data: users } = await supabase
        .from('profiles')
        .select('role')
        .eq('company_id', currentUser.company_id);

      const { data: roles } = await supabase
        .from('roles')
        .select('name, is_default')
        .eq('company_id', currentUser.company_id);

      if (users && roles) {
        const roleMap = new Map<string, number>();
        users.forEach((user: any) => {
          const count = roleMap.get(user.role) || 0;
          roleMap.set(user.role, count + 1);
        });

        const usage: RoleUsage[] = (roles as any[]).map((role) => ({
          role_name: role.name,
          user_count: roleMap.get(role.name) || 0,
          is_default: role.is_default,
        }));

        setRoleUsage(usage);
        setTotalUsers(users.length);
      }
    } catch (error) {
      console.error('Error fetching role usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const unusedRoles = roleUsage.filter((r) => r.user_count === 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUsers}</div>
          <p className="text-xs text-muted-foreground">Active users in the system</p>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{roleUsage.length}</div>
          <p className="text-xs text-muted-foreground">
            {roleUsage.filter((r) => r.is_default).length} default roles
          </p>
        </CardContent>
      </Card>

      <Card className={`shadow-card ${unusedRoles.length > 0 ? 'border-warning/50' : ''}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unused Roles</CardTitle>
          <AlertCircle className={`h-4 w-4 ${unusedRoles.length > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{unusedRoles.length}</div>
          <p className="text-xs text-muted-foreground">Roles with no assigned users</p>
        </CardContent>
      </Card>

      <Card className="shadow-card md:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Role Usage Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : roleUsage.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No roles found</div>
          ) : (
            <div className="space-y-3">
              {roleUsage
                .sort((a, b) => b.user_count - a.user_count)
                .map((role) => (
                  <div key={role.role_name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{role.role_name}</span>
                        {role.is_default && (
                          <Badge variant="outline" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {role.user_count} {role.user_count === 1 ? 'user' : 'users'}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{
                          width: `${totalUsers > 0 ? (role.user_count / totalUsers) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {unusedRoles.length > 0 && (
        <Card className="shadow-card md:col-span-3 border-warning/50">
          <CardHeader>
            <CardTitle className="text-base">Recommendation: Unused Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              The following roles have no assigned users. Consider deleting them to reduce complexity:
            </p>
            <div className="flex flex-wrap gap-2">
              {unusedRoles.map((role) => (
                <Badge
                  key={role.role_name}
                  variant="outline"
                  className="border-warning/50 bg-warning-light/20 text-warning"
                >
                  {role.role_name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
