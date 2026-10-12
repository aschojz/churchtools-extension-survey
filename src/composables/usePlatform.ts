import { churchtoolsClient } from '@churchtools/churchtools-client';
import { useQuery } from '@tanstack/vue-query';
import { KEY } from '../config';
export type Person = { id: number; firstName?: string; lastName?: string; email?: string };
export type Permissions = Record<string, Record<string, boolean | number[]>>;
export function permissionAllowed(permissions: Permissions | undefined, action: string, id?: number) {
    const permission = permissions?.[KEY]?.[action];
    return (
        permission === true ||
        (Array.isArray(permission) &&
            (id === undefined ? permission.length > 0 : permission.includes(-1) || permission.includes(id)))
    );
}
export function usePermissions() {
    const query = useQuery({
        queryKey: ['survey-permissions'],
        queryFn: () => churchtoolsClient.get<Permissions>('/permissions/global'),
    });
    return { ...query, allowed: (action: string, id?: number) => permissionAllowed(query.data.value, action, id) };
}
export function useCurrentUser() {
    return useQuery({
        queryKey: ['survey-current-user'],
        queryFn: () => churchtoolsClient.get<Person>('/whoami'),
        retry: false,
    });
}
