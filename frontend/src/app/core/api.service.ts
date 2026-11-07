import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  department?: string;
  role: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  documentCount: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags?: string;
  folderId?: string | null;
  folderName?: string | null;
  ownerEmail: string;
  size?: number;
  contentType?: string;
  status: string;
  scanFailureReason?: string | null;
  currentVersion?: number;
  createdAt: string;
  updatedAt?: string;
  isOwner: boolean;
  accessLevel: 'Owner' | 'Edit' | 'Read';
  canRead: boolean;
  canEdit: boolean;
}

export interface AuditItem {
  id: number;
  correlationId?: string;
  actorId: string;
  actorEmail?: string;
  documentId?: string;
  documentName?: string;
  action: string;
  result: string;
  reason?: string;
  createdAt: string;
  previousHash?: string;
  entryHash: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  documentId?: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api';

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.base}/auth/login`, { email, password });
  }
  me(): Observable<User> {
    return this.http.get<User>(`${this.base}/users/me`);
  }
  updateProfile(fullName: string, department: string): Observable<User> {
    return this.http.put<User>(`${this.base}/users/me`, { fullName, department });
  }
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/change-password`, { currentPassword, newPassword });
  }
  documents(): Observable<DocumentItem[]> {
    return this.http.get<DocumentItem[]>(`${this.base}/documents`);
  }
  preview(id: string): Observable<any> {
    return this.http.get(`${this.base}/documents/${id}/preview`);
  }
  upload(file: File, category: string, description = '', tags = '', folderId = ''): Observable<any> {
    const data = new FormData();
    data.append('file', file);
    data.append('category', category);
    data.append('description', description);
    data.append('tags', tags);
    if (folderId) data.append('folderId', folderId);
    return this.http.post(`${this.base}/documents`, data);
  }
  retryScan(id: string): Observable<any> {
    return this.http.post(`${this.base}/documents/${id}/retry-scan`, {});
  }
  update(id: string, payload: { name?: string; category?: string; description?: string; tags?: string; folderId?: string | null }): Observable<void> {
    return this.http.put<void>(`${this.base}/documents/${id}`, payload);
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/documents/${id}`);
  }
  permissions(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/documents/${id}/permissions`);
  }
  grant(id: string, email: string, access: string, expiresAt?: string): Observable<any> {
    return this.http.post(`${this.base}/documents/${id}/permissions`, { email, access, expiresAt });
  }
  revoke(id: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/documents/${id}/permissions/${userId}`);
  }
  folders(): Observable<FolderItem[]> {
    return this.http.get<FolderItem[]>(`${this.base}/folders`);
  }
  createFolder(name: string, description: string): Observable<FolderItem> {
    return this.http.post<FolderItem>(`${this.base}/folders`, { name, description });
  }
  deleteFolder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/folders/${id}`);
  }
  notifications(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(`${this.base}/notifications`);
  }
  markNotificationRead(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/notifications/${id}/read`, {});
  }
  audit(): Observable<AuditItem[]> {
    return this.http.get<AuditItem[]>(`${this.base}/audit`);
  }
  adminStats(): Observable<any> {
    return this.http.get(`${this.base}/admin/stats`);
  }
  verifyAuditChain(): Observable<any> {
    return this.http.get(`${this.base}/admin/verify-audit-chain`);
  }
  users(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/admin/users`);
  }
  createUser(email: string, temporaryPassword: string, role: string, fullName = '', department = 'General'): Observable<any> {
    return this.http.post(`${this.base}/admin/users`, { email, temporaryPassword, role, fullName, department });
  }
  setUserStatus(id: string, isActive: boolean): Observable<any> {
    return this.http.put(`${this.base}/admin/users/${id}/status`, { isActive });
  }
  setUserRole(id: string, role: string): Observable<any> {
    return this.http.put(`${this.base}/admin/users/${id}/role`, { role });
  }
  download(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/documents/${id}/download`, { responseType: 'blob' });
  }
}
