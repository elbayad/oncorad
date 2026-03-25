import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Shield,
  Settings,
  Map as MapIcon,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  Database,
  Stethoscope,
  User,
  Box,
  Layout,
  BedDouble,
  Zap,
  Wind,
  Activity,
  Ambulance,
  Grid,
  Megaphone,
  Bed,
  Key,
  Syringe,
  Pill,
  Thermometer,
  Briefcase,
  Microscope,
  Dna,
  Brain,
  FlaskConical,
  Radiation,
  Baby,
  Bone,
  Eye,
  HeartPulse,
  Droplets,
  ClipboardList
} from 'lucide-react';

import { MEDICAL_ICON_LIBRARY, ICON_GROUPS } from '../../constants/medicalIcons';

const ICON_COMPONENTS: Record<string, any> = {
  // Lucide Icons
  User, Box, Bed, Stethoscope, Activity, Syringe, Pill, Thermometer, Briefcase,
  Microscope, Dna, Brain, FlaskConical, Radiation, Baby, Bone, Eye, HeartPulse, Droplets,
  ClipboardList, Ambulance,
  // Custom Medical Icons
  ...Object.keys(MEDICAL_ICON_LIBRARY).reduce((acc, key) => ({
    ...acc,
    [key]: (props: any) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
        dangerouslySetInnerHTML={{ __html: MEDICAL_ICON_LIBRARY[key] }}
      />
    )
  }), {})
};

import GeofenceMapEditor from '../../components/GeofenceMapEditor';
import EnergySettings from './components/EnergySettings';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  modules: string[];
  floor: number;
  status: 'active' | 'inactive';
  lastLogin: string;
}

interface Asset {
  id: string;
  name: string;
  type_id: string | number;
  category: string | number;
  category_name?: string;
  floor_id: number;
  status: 'active' | 'inactive' | 'idle' | 'offline';
  type_name?: string;
  icon?: string;
  color?: string;
}

export default function AdminPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Assets Management State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetTypes, setAssetTypes] = useState<any[]>([]);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetFilter, setAssetFilter] = useState('all'); // all, medecin, person, equipment

  const [newAsset, setNewAsset] = useState<Partial<Asset>>({
    name: '',
    type_id: 3,
    category: 2,
    floor_id: 1,
    status: 'active'
  });

  const [assetCategories, setAssetCategories] = useState<any[]>([]);
  const [activeAssetSubTab, setActiveAssetSubTab] = useState('list'); // list, types, categories
  const [showAssetTypeModal, setShowAssetTypeModal] = useState(false);
  const [editingAssetType, setEditingAssetType] = useState<any>(null);
  const [showAssetCategoryModal, setShowAssetCategoryModal] = useState(false);
  const [editingAssetCategory, setEditingAssetCategory] = useState<any>(null);

  const [newAssetType, setNewAssetType] = useState<any>({
    id: 0,
    name: '',
    description: '',
    icon: 'Box',
    color: '#3B82F6',
    id_categorie: 1
  });

  const [newAssetCategory, setNewAssetCategory] = useState({
    categorie: ''
  });

  // Floors & Rooms State
  const [floors, setFloors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [editingFloor, setEditingFloor] = useState<any>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [selectedFloorForRooms, setSelectedFloorForRooms] = useState<number | string>('');

  const [newFloor, setNewFloor] = useState({
    name: '',
    description: '',
    plan: '',
    is_active: true
  });

  // Floor Map Editing State
  const [mapEditingFloor, setMapEditingFloor] = useState<any>(null);
  const [mapEditMode, setMapEditMode] = useState<'polygon' | 'linestring'>('polygon');

  const handleEditCorridor = (floor: any) => {
    setMapEditingFloor(floor);
    setMapEditMode('polygon');
  };

  const handleEditTrajet = (floor: any) => {
    setMapEditingFloor(floor);
    setMapEditMode('linestring');
  };

  const handleSaveFloorMap = async (geojsonData: any) => {
    if (!mapEditingFloor) return;

    const isCorridor = mapEditMode === 'polygon';
    const updatedFloor = {
      ...mapEditingFloor,
      corridor: isCorridor ? geojsonData : mapEditingFloor.corridor,
      trajet: !isCorridor ? geojsonData : mapEditingFloor.trajet,
      is_active: mapEditingFloor.is_active !== undefined ? mapEditingFloor.is_active : true
    };

    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch(`/api/floors/${mapEditingFloor.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updatedFloor)
      });
      const json = await res.json();
      if (json.success) {
        fetchFloors();
        setMapEditingFloor(null);
      } else {
        alert(t('common.error') + ': ' + json.message);
      }
    } catch (err) {
      console.error("Error saving floor map", err);
      alert(t('common.error'));
    }
  };

  const [newRoom, setNewRoom] = useState({
    room_number: '',
    floor_id: 1,
    type: 'standard',
    is_active: true
  });

  const [geofenceRoom, setGeofenceRoom] = useState<any>(null);

  const handleSaveRoomGeofence = async (geofence: string) => {
    if (!geofenceRoom) return;
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch(`/api/rooms/${geofenceRoom.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...geofenceRoom, polygon: geofence })
      });
      const json = await res.json();
      if (json.success) {
        fetchRooms();
        setGeofenceRoom(null);
      }
    } catch (err) {
      console.error("Failed to save room geofence", err);
    }
  };

  // Zones State
  const [zones, setZones] = useState<any[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [newZone, setNewZone] = useState({
    name: '',
    description: '',
    type: 'standard',
    floor_id: 1,
    polygon: ''
  });

  const [geofenceZone, setGeofenceZone] = useState<any>(null);

  const handleSaveZoneGeofence = (geofence: string) => {
    if (editingZone) {
      setEditingZone({ ...editingZone, polygon: geofence });
    } else {
      setNewZone({ ...newZone, polygon: geofence });
    }
    setGeofenceZone(null);
  };

  // Sirens State
  const [sirens, setSirens] = useState<any[]>([]);
  const [loadingSirens, setLoadingSirens] = useState(false);
  const [showSirenModal, setShowSirenModal] = useState(false);
  const [showGeofenceEditor, setShowGeofenceEditor] = useState(false);
  const [editingSiren, setEditingSiren] = useState<any>(null);
  const [newSiren, setNewSiren] = useState({
    mac: '',
    name: '',
    designation: '',
    geofence: '',
    output_channel: 'state1', // Default to state1
    floor_id: 1
  });

  // Equipment State
  const [activeEquipTab, setActiveEquipTab] = useState('oxygen');
  const [activeEnergySubTab, setActiveEnergySubTab] = useState('meters');
  const [loadingEquip, setLoadingEquip] = useState(false);

  const [oxygenPoints, setOxygenPoints] = useState<any[]>([]);
  const [showOxygenModal, setShowOxygenModal] = useState(false);
  const [editingOxygen, setEditingOxygen] = useState<any>(null);
  const [newOxygen, setNewOxygen] = useState({
    name: '',
    floor_id: 1,
    location: '',
    zone: '',
    point_type: 'outlet',
    is_active: true,
    mac: '',
    room_id: null as number | null,
    installation_date: '',
    last_maintenance: '',
    next_maintenance: ''
  });

  const [energyMeters, setEnergyMeters] = useState<any[]>([]);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [editingEnergy, setEditingEnergy] = useState<any>(null);
  const [newEnergy, setNewEnergy] = useState({
    name: '',
    designation: '',
    floor_id: 1,
    zone: '',
    meter_type: 'compteur',
    max_capacity_kw: 100,
    is_active: true,
    device: '',
    channel: '',
    cable: '',
    ctcurrent: 1,
    installation_date: '',
    last_maintenance: ''
  });

  const [airSensors, setAirSensors] = useState<any[]>([]);
  const [showAirModal, setShowAirModal] = useState(false);
  const [editingAir, setEditingAir] = useState<any>(null);
  const [newAir, setNewAir] = useState({
    name: '', floor_id: 1, zone: '', is_active: true,
    temp_min_warning: 18, temp_max_warning: 26, temp_min_critical: 15, temp_max_critical: 32,
    hum_min_warning: 30, hum_max_warning: 60, hum_min_critical: 20, hum_max_critical: 80,
    pm25_warning: 35, pm25_critical: 75,
    tvoc_warning: 500, tvoc_critical: 1500,
    co2_warning: 1000, co2_critical: 2000
  });

  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [editingAmbulance, setEditingAmbulance] = useState<any>(null);
  const [newAmbulance, setNewAmbulance] = useState({
    call_sign: '',
    license_plate: '',
    status: 'available',
    crew_capacity: 3,
    equipment_level: 'basic',
    imei_tablette: '',
    imei_gps: '',
    is_active: true
  });

  // Reset Password State
  const [showResetModal, setShowResetModal] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/users', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        setUsers(json.data.map((u: any) => ({
          ...u,
          status: u.is_active ? 'active' : 'inactive',
          lastLogin: u.last_login ? new Date(u.last_login).toLocaleString() : t('admin.users.never')
        })));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const modules = [
    { id: 'ambutrack', name: t('admin.modules.ambutrack'), description: t('admin.modules.ambutrackDesc') },
    { id: 'floortrace', name: t('admin.modules.floortrace'), description: t('admin.modules.floortraceDesc') },
    { id: 'energypulse', name: t('admin.modules.energypulse'), description: t('admin.modules.energypulseDesc') },
    { id: 'airguard', name: t('admin.modules.airguard'), description: t('admin.modules.airguardDesc') },
    { id: 'oxyflow', name: t('admin.modules.oxyflow'), description: t('admin.modules.oxyflowDesc') },
    { id: 'dossier-patient', name: t('admin.modules.dossierPatient'), description: t('admin.modules.dossierPatientDesc') },
    { id: 'admission', name: t('admin.modules.admission'), description: t('admin.modules.admissionDesc') },
    { id: 'reporting', name: t('admin.modules.reporting'), description: t('admin.modules.reportingDesc') }
  ];

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const [newUser, setNewUser] = useState<Partial<User & { password?: string }>>({
    name: '',
    email: '',
    password: '',
    role: 'user',
    modules: [],
    floor: 1,
    status: 'active'
  });

  const handleSaveUser = async () => {
    const token = localStorage.getItem('clinicToken');
    const userData = editingUser || newUser;

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...userData,
          floor_access: userData.floor || 0,
          is_active: userData.status === 'active'
        })
      });

      const json = await res.json();
      if (json.success) {
        fetchUsers();
        setShowUserModal(false);
        setEditingUser(null);
        setNewUser({
          name: '',
          email: '',
          password: '',
          role: 'user',
          modules: [],
          floor: 1,
          status: 'active'
        });
      } else {
        alert(json.message || t('common.error'));
      }
    } catch (err) {
      console.error('Error saving user:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(t('admin.users.confirmDelete'))) return;
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const handleResetPassword = (user: User) => {
    setUserToReset(user);
    setResetPassword('');
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    if (!userToReset || !resetPassword) return;
    if (resetPassword.length < 6) {
      alert(t('admin.users.passwordPlaceholder'));
      return;
    }

    setIsResetting(true);
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch(`/api/users/${userToReset.id}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ password: resetPassword })
      });
      const json = await res.json();
      if (json.success) {
        alert(t('admin.users.passwordUpdated'));
        setShowResetModal(false);
        setUserToReset(null);
        setResetPassword('');
      } else {
        alert(json.message || t('common.error'));
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      alert(t('admin.users.resetError'));
    } finally {
      setIsResetting(false);
    }
  };

  // Asset Actions
  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/assets', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        setAssets(json.data);
      }
    } catch (err) {
    } finally {
      setLoadingAssets(false);
    }
  };

  const fetchAssetTypes = async () => {
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/assets/types', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        setAssetTypes(json.data);
      }
    } catch (err) {
      console.error('Error fetching asset types', err);
    }
  };

  const fetchAssetCategories = async () => {
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/assets/categories', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        setAssetCategories(json.data);
      }
    } catch (err) {
      console.error('Error fetching asset categories', err);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'assets') {
      fetchAssets();
      fetchAssetTypes();
      fetchAssetCategories();
      fetchFloors(); // Ensure floors are loaded for the modal
    }
  }, [activeTab]);

  const handleSaveAsset = async () => {
    const token = localStorage.getItem('clinicToken');
    const assetData = editingAsset || newAsset;

    // Set category based on type_id logic
    const selectedType = assetTypes.find(t => String(t.id) === String(assetData.type_id));
    if (selectedType) {
      assetData.category = selectedType.id_categorie || selectedType.category_name;
    }

    try {
      let url = '/api/assets';
      let method = 'POST';
      if (editingAsset) {
        url = `/api/assets/${editingAsset.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(assetData)
      });

      const json = await res.json();
      if (json.success) {
        fetchAssets();
        setShowAssetModal(false);
        setEditingAsset(null);
        setNewAsset({
          name: '',
          type_id: 3,
          category: 2,
          floor_id: 1,
          status: 'active'
        });
      }
    } catch (err) {
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm(t('admin.assets.confirmDelete'))) return;
    try {
      const token = localStorage.getItem('clinicToken');
      await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchAssets();
    } catch (err) {
    }
  };

  const handleSaveAssetType = async () => {
    const token = localStorage.getItem('clinicToken');
    const typeData = editingAssetType || newAssetType;

    try {
      let url = '/api/assets/types';
      let method = 'POST';
      if (editingAssetType) {
        url = `/api/assets/types/${editingAssetType.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(typeData)
      });

      const json = await res.json();
      if (json.success) {
        fetchAssetTypes();
        setShowAssetTypeModal(false);
        setEditingAssetType(null);
        setNewAssetType({
          id: '',
          name: '',
          description: '',
          icon: 'Box',
          color: '#3B82F6',
          id_categorie: assetCategories[0]?.id || 1
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAssetType = async (id: string) => {
    if (!confirm(t('admin.assets.confirmDelete'))) return;
    try {
      const token = localStorage.getItem('clinicToken');
      await fetch(`/api/assets/types/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchAssetTypes();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAssetCategory = async () => {
    const token = localStorage.getItem('clinicToken');
    const categoryData = editingAssetCategory || newAssetCategory;

    try {
      let url = '/api/assets/categories';
      let method = 'POST';
      if (editingAssetCategory) {
        url = `/api/assets/categories/${editingAssetCategory.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(categoryData)
      });

      const json = await res.json();
      if (json.success) {
        fetchAssetCategories();
        setShowAssetCategoryModal(false);
        setEditingAssetCategory(null);
        setNewAssetCategory({ categorie: '' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAssetCategory = async (id: number) => {
    if (!confirm(t('admin.assets.confirmDelete'))) return;
    try {
      const token = localStorage.getItem('clinicToken');
      await fetch(`/api/assets/categories/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchAssetCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = React.useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [users, searchTerm]);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = assetFilter === 'all' || String(asset.type_id) === String(assetFilter);
    return matchesSearch && matchesFilter;
  });

  // Floor & Room Actions
  const fetchFloors = async () => {
    setLoadingFloors(true);
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/floors', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        setFloors(json.data);
        if (!selectedFloorForRooms && json.data.length > 0) {
          setSelectedFloorForRooms(json.data[0].id);
        }
      }
    } catch (err) {
    } finally {
      setLoadingFloors(false);
    }
  };

  const fetchRooms = async () => {
    if (!selectedFloorForRooms) return;
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch(`/api/rooms?floorId=${selectedFloorForRooms}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        setRooms(json.data);
      }
    } catch (err) {
    }
  };

  const fetchAllRooms = async () => {
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/rooms', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        setRooms(json.data);
      }
    } catch (err) {
    }
  };

  React.useEffect(() => {
    if (activeTab === 'floors_rooms') {
      fetchFloors();
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab === 'floors_rooms' && selectedFloorForRooms) {
      fetchRooms();
    }
  }, [selectedFloorForRooms, activeTab]);

  const handleSaveFloor = async () => {
    const token = localStorage.getItem('clinicToken');
    const floorData = editingFloor || newFloor;
    try {
      let url = '/api/floors';
      let method = 'POST';
      if (editingFloor) {
        url = `/api/floors/${editingFloor.id}`;
        method = 'PUT';
      }
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(floorData)
      });
      const json = await res.json();
      if (json.success) {
        fetchFloors();
        setShowFloorModal(false);
        setEditingFloor(null);
        setNewFloor({ name: '', description: '', plan: '', is_active: true });
      }
    } catch (err) {
    }
  };

  const handleDeleteFloor = async (id: number) => {
    if (!confirm(t('admin.floors.confirmDelete'))) return;
    try {
      const token = localStorage.getItem('clinicToken');
      await fetch(`/api/floors/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchFloors();
    } catch (err) {
    }
  };

  const handleSaveRoom = async () => {
    const token = localStorage.getItem('clinicToken');
    const roomData = editingRoom || newRoom;
    try {
      let url = '/api/rooms';
      let method = 'POST';
      if (editingRoom) {
        url = `/api/rooms/${editingRoom.id}`;
        method = 'PUT';
      }
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(roomData)
      });
      const json = await res.json();
      if (json.success) {
        fetchRooms();
        setShowRoomModal(false);
        setEditingRoom(null);
        setNewRoom({ room_number: '', floor_id: Number(selectedFloorForRooms), type: 'standard', is_active: true });
      }
    } catch (err) {
    }
  };

  const handleDeleteRoom = async (id: number) => {
    if (!confirm(t('admin.rooms.confirmDelete'))) return;
    try {
      const token = localStorage.getItem('clinicToken');
      await fetch(`/api/rooms/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchRooms();
    } catch (err) {
    }
  };

  const fetchZones = async () => {
    setLoadingZones(true);
    try {
      const token = localStorage.getItem('clinicToken');
      // Fetch all global zones
      const res = await fetch(`/api/zones`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        setZones(json.data);
      }
    } catch (err) {
    } finally {
      setLoadingZones(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'floors_rooms') {
      fetchFloors();
    }
    if (activeTab === 'zones') {
      fetchZones();
      fetchFloors();
    }
    if (activeTab === 'sirens') {
      fetchSirens();
      fetchFloors(); // Ensure floors are loaded for Geofence Editor
    }
  }, [activeTab]);

  const handleSaveZone = async () => {
    const token = localStorage.getItem('clinicToken');
    const zoneData = editingZone || newZone;
    try {
      let url = '/api/zones';
      let method = 'POST';
      if (editingZone) {
        url = `/api/zones/${editingZone.id}`;
        method = 'PUT';
      }
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(zoneData)
      });
      const json = await res.json();
      if (json.success) {
        fetchZones();
        setShowZoneModal(false);
        setEditingZone(null);
        setNewZone({ name: '', description: '', type: 'standard', floor_id: 1, polygon: '' });
      } else {
        console.error("Save failed:", json);
        alert(t('admin.zones.serverError', { message: json.message || 'Inconnue' }));
      }
    } catch (err) {
      console.error("Error saving zone:", err);
      alert(t('admin.zones.networkError', { error: err }));
    }
  };

  const handleDeleteZone = async (id: number) => {
    if (!confirm(t('admin.zones.confirmDelete'))) return;
    try {
      const token = localStorage.getItem('clinicToken');
      await fetch(`/api/zones/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchZones();
    } catch (err) {
    }
  };

  // Equipment Actions
  const fetchOxygenPoints = async () => {
    setLoadingEquip(true);
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/oxygen', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const json = await res.json();
      if (json.success) setOxygenPoints(json.data);
    } catch (e) {
      // error suppressed
    } finally { setLoadingEquip(false); }
  };

  const fetchEnergyMeters = async () => {
    setLoadingEquip(true);
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/energy?showInactive=true', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const json = await res.json();
      if (json.success) setEnergyMeters(json.data);
    } catch (e) {
      // error suppressed
    } finally { setLoadingEquip(false); }
  };

  const fetchAirSensors = async () => {
    setLoadingEquip(true);
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/air', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const json = await res.json();
      if (json.success) setAirSensors(json.data);
    } catch (e) {
      // error suppressed
    } finally { setLoadingEquip(false); }
  };


  const fetchAmbulances = async () => {
    setLoadingEquip(true);
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/ambulances', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      const json = await res.json();
      if (json.success) setAmbulances(json.data);
    } catch (e) {
      console.error(e);
    } finally { setLoadingEquip(false); }
  };

  useEffect(() => {
    if (activeTab === 'equipment') {
      fetchFloors();
      fetchAllRooms();
      if (activeEquipTab === 'oxygen') fetchOxygenPoints();
      else if (activeEquipTab === 'energy') fetchEnergyMeters();
      else if (activeEquipTab === 'air') fetchAirSensors();

      else if (activeEquipTab === 'ambulance') fetchAmbulances();
    }
  }, [activeTab, activeEquipTab]);

  const handleSaveOxygen = async () => {
    const token = localStorage.getItem('clinicToken');
    const data = editingOxygen || newOxygen;
    const url = editingOxygen ? `/api/oxygen/${editingOxygen.id}` : '/api/oxygen';
    const method = editingOxygen ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify(data)
      });
      if ((await res.json()).success) {
        fetchOxygenPoints();
        setShowOxygenModal(false);
        setEditingOxygen(null);
        setNewOxygen({
          name: '',
          floor_id: 1,
          location: '',
          zone: '',
          point_type: 'outlet',
          is_active: true,
          mac: '',
          room_id: null,
          installation_date: '',
          last_maintenance: '',
          next_maintenance: ''
        });
      }
    } catch (e) {
      // error
    }
  };

  const handleDeleteOxygen = async (id: number) => {
    if (!confirm(t('admin.equipment.confirmDeleteOxygen'))) return;
    const token = localStorage.getItem('clinicToken');
    try {
      await fetch(`/api/oxygen/${id}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      fetchOxygenPoints();
    } catch (e) {
      // error
    }
  };

  const handleSaveEnergy = async () => {
    const token = localStorage.getItem('clinicToken');
    const data = editingEnergy || newEnergy;
    const url = editingEnergy ? `/api/energy/${editingEnergy.id}` : '/api/energy';
    const method = editingEnergy ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        fetchEnergyMeters();
        setShowEnergyModal(false);
        setEditingEnergy(null);
        setNewEnergy({
          name: '',
          designation: '',
          floor_id: 1,
          zone: '',
          meter_type: 'compteur',
          max_capacity_kw: 100,
          is_active: true,
          device: '',
          channel: '',
          cable: '',
          ctcurrent: 1,
          installation_date: '',
          last_maintenance: ''
        });
      } else {
        alert(t('common.error') + ': ' + json.message);
      }
    } catch (e) {
      console.error(e);
      alert(t('common.error'));
    }
  };

  const handleDeleteEnergy = async (id: number) => {
    if (!confirm(t('admin.equipment.confirmDeleteEnergy'))) return;
    const token = localStorage.getItem('clinicToken');
    try {
      await fetch(`/api/energy/${id}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      fetchEnergyMeters();
    } catch (e) {
      // error
    }
  };

  const handleSaveAir = async () => {
    const token = localStorage.getItem('clinicToken');
    const data = editingAir || newAir;
    const url = editingAir ? `/api/air/${editingAir.id}` : '/api/air';
    const method = editingAir ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify(data)
      });
      if ((await res.json()).success) {
        fetchAirSensors();
        setShowAirModal(false);
        setEditingAir(null);
        setNewAir({
          name: '', floor_id: 1, zone: '', is_active: true,
          temp_min_warning: 18, temp_max_warning: 26, temp_min_critical: 15, temp_max_critical: 32,
          hum_min_warning: 30, hum_max_warning: 60, hum_min_critical: 20, hum_max_critical: 80,
          pm25_warning: 35, pm25_critical: 75,
          tvoc_warning: 500, tvoc_critical: 1500,
          co2_warning: 1000, co2_critical: 2000
        });
      }
    } catch (e) {
      // error
    }
  };

  const handleDeleteAir = async (id: number) => {
    if (!confirm(t('admin.equipment.confirmDeleteAir'))) return;
    const token = localStorage.getItem('clinicToken');
    try {
      await fetch(`/api/air/${id}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
      fetchAirSensors();
    } catch (e) {
      // error
    }
  };


  const handleSaveAmbulance = async () => {
    const token = localStorage.getItem('clinicToken');
    const data = editingAmbulance || newAmbulance;
    const url = editingAmbulance ? `/api/ambulances/${editingAmbulance.id}` : '/api/ambulances';
    const method = editingAmbulance ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        fetchAmbulances();
        setShowAmbulanceModal(false);
        setEditingAmbulance(null);
        setNewAmbulance({
          call_sign: '',
          license_plate: '',
          status: 'available',
          crew_capacity: 3,
          equipment_level: 'basic',
          imei_tablette: '',
          imei_gps: '',
          is_active: true
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAmbulance = async (id: number) => {
    if (!confirm(t('admin.equipment.confirmDeleteAmbulance'))) return;
    try {
      const token = localStorage.getItem('clinicToken');
      await fetch(`/api/ambulances/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchAmbulances();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSirens = async () => {
    setLoadingSirens(true);
    try {
      const token = localStorage.getItem('clinicToken');
      const res = await fetch('/api/sirens', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (json.success) {
        setSirens(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSirens(false);
    }
  };

  const handleSaveSiren = async () => {
    const token = localStorage.getItem('clinicToken');
    const data = editingSiren || newSiren;
    const url = editingSiren ? `/api/sirens/${editingSiren.id}` : '/api/sirens';
    const method = editingSiren ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.success) {
        fetchSirens();
        setShowSirenModal(false);
        setEditingSiren(null);
        setNewSiren({
          mac: '',
          name: '',
          designation: '',
          geofence: '',
          output_channel: 'state1',
          floor_id: 1
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSiren = async (id: number) => {
    if (!confirm(t('admin.sirens.confirmDelete'))) return;
    try {
      const token = localStorage.getItem('clinicToken');
      await fetch(`/api/sirens/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchSirens();
    } catch (err) {
      console.error(err);
    }
  };

  const tabs = [
    { id: 'users', name: t('admin.tabs.users'), icon: Users },
    { id: 'permissions', name: t('admin.tabs.permissions'), icon: Shield },

    { id: 'assets', name: t('admin.tabs.assets'), icon: Database },
    { id: 'floors_rooms', name: t('admin.tabs.floorsRooms'), icon: Layout },
    { id: 'zones', name: t('admin.tabs.zones'), icon: Grid },
    { id: 'sirens', name: t('admin.tabs.sirens'), icon: Megaphone },
    { id: 'equipment', name: t('admin.tabs.equipment'), icon: Box },
    { id: 'system', name: t('admin.tabs.system'), icon: Settings }
  ];

  return (
    <div className="space-y-6" >
      {/* Tabs */}
      < div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700" >
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Users header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t('admin.users.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('admin.users.addUser')}</span>
                </button>
              </div>

              {/* Users table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('admin.users.name')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('admin.users.role')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('admin.users.modules')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('admin.users.floor')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('admin.users.lastLogin')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {loadingUsers ? (
                      <tr><td colSpan={6} className="px-6 py-4 text-center">{t('admin.users.loadingUsers')}</td></tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-4 text-center">{t('admin.users.noUsersFound')}</td></tr>
                    ) : filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-xs">
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {user.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                            }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {(user.modules || []).length} module{(user.modules || []).length > 1 ? 's' : ''}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {(user.modules || []).slice(0, 3).join(', ')}
                            {(user.modules || []).length > 3 && '...'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {user.floor === 0 ? t('common.all') : t('admin.users.floorN', { n: user.floor })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {user.lastLogin}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setShowUserModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title={t('common.edit')}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleResetPassword(user)}
                              className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                              title={t('admin.users.resetPassword')}
                            >
                              <Key className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="space-y-6">
              {/* Asset Sub-tabs */}
              <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveAssetSubTab('list')}
                  className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${activeAssetSubTab === 'list'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  {t('admin.assets.listSubTab') || 'Liste des Assets'}
                </button>
                <button
                  onClick={() => setActiveAssetSubTab('types')}
                  className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${activeAssetSubTab === 'types'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  {t('admin.assets.typesSubTab') || 'Types'}
                </button>
                <button
                  onClick={() => setActiveAssetSubTab('categories')}
                  className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${activeAssetSubTab === 'categories'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  {t('admin.assets.categoriesSubTab') || 'Catégories'}
                </button>
              </div>

              {activeAssetSubTab === 'list' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder={t('admin.assets.searchPlaceholder')}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <select
                        value={assetFilter}
                        onChange={(e) => setAssetFilter(e.target.value)}
                        className="pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="all">{t('admin.assets.allTypes')}</option>
                        {assetTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => setShowAssetModal(true)}
                      className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t('admin.assets.addAsset')}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.name')}</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.type')}</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.assets.category')}</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.floor')}</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loadingAssets ? (
                          <tr><td colSpan={5} className="px-6 py-4 text-center text-sm">{t('common.loading')}</td></tr>
                        ) : filteredAssets.map((asset) => (
                          <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{asset.name}</div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase">{asset.id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2 text-sm">
                                {(() => {
                                  const iconName = asset.icon || '';
                                  const tid = String(asset.type_id);
                                  const IconComponent = ICON_COMPONENTS[iconName] || null;

                                  if (IconComponent) return <IconComponent className="h-4 w-4" style={{ color: asset.color || '#3B82F6' }} />;

                                  // Modernized fallback logic using library keys
                                  if (tid === '4' || tid === 'patient') {
                                    const PatIcon = ICON_COMPONENTS['patient'];
                                    return <PatIcon className="h-4 w-4" style={{ color: asset.color || '#7c3aed' }} />;
                                  }
                                  if (tid === '3' || tid === 'medecin') {
                                    const MedIcon = ICON_COMPONENTS['medecin'];
                                    return <MedIcon className="h-4 w-4" style={{ color: asset.color || '#2563eb' }} />;
                                  }
                                  if (tid === '5' || tid === 'person' || tid === 'nurse') {
                                    const StaffIcon = ICON_COMPONENTS['personnel'];
                                    return <StaffIcon className="h-4 w-4" style={{ color: asset.color || '#111827' }} />;
                                  }

                                  const BoxIcon = ICON_COMPONENTS['box'];
                                  return <BoxIcon className="h-4 w-4" style={{ color: asset.color || '#059669' }} />;
                                })()}
                                <span className="capitalize">{asset.type_name || asset.type_id}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{asset.category_name || asset.category}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {asset.floor_id ? t('admin.assets.floorN', { n: asset.floor_id }) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button onClick={() => { setEditingAsset(asset); setShowAssetModal(true); }} className="text-blue-600 hover:text-blue-900 dark:text-blue-400"><Edit className="h-4 w-4" /></button>
                                <button onClick={() => handleDeleteAsset(asset.id)} className="text-red-600 hover:text-red-900 dark:text-red-400"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeAssetSubTab === 'types' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white uppercase tracking-wider text-xs">{t('admin.assets.typesTitle') || 'Gestion des Types'}</h4>
                    <button
                      onClick={() => {
                        setEditingAssetType(null);
                        setNewAssetType({ id: '', name: '', description: '', icon: 'Box', color: '#3B82F6', id_categorie: assetCategories[0]?.id || 1 });
                        setShowAssetTypeModal(true);
                      }}
                      className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t('admin.assets.addType') || 'Ajouter un Type'}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID / Nom</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Catégorie</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Visuel</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {assetTypes.map((type) => (
                          <tr key={type.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900 dark:text-white">{type.name}</div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono uppercase">{type.id}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{type.description}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {type.category_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <div className="p-1 px-2 rounded-md text-white text-xs font-bold" style={{ backgroundColor: type.color }}>
                                  {type.icon}
                                </div>
                                <div className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600 shadow-sm" style={{ backgroundColor: type.color }} />
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button onClick={() => { setEditingAssetType(type); setShowAssetTypeModal(true); }} className="text-blue-600 hover:text-blue-900 dark:text-blue-400"><Edit className="h-4 w-4" /></button>
                                <button onClick={() => handleDeleteAssetType(type.id)} className="text-red-600 hover:text-red-900 dark:text-red-400"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeAssetSubTab === 'categories' && (
                <div className="space-y-4 max-w-2xl">
                  <div className="flex justify-between items-center">
                    <h4 className="text-md font-medium text-gray-900 dark:text-white uppercase tracking-wider text-xs">{t('admin.assets.categoriesTitle') || 'Gestion des Catégories'}</h4>
                    <button
                      onClick={() => {
                        setEditingAssetCategory(null);
                        setNewAssetCategory({ categorie: '' });
                        setShowAssetCategoryModal(true);
                      }}
                      className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t('admin.assets.addCategory') || 'Ajouter une Catégorie'}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Libellé</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {assetCategories.map((cat) => (
                          <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">#{cat.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">{cat.categorie}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button onClick={() => { setEditingAssetCategory(cat); setShowAssetCategoryModal(true); }} className="text-blue-600 hover:text-blue-900 dark:text-blue-400"><Edit className="h-4 w-4" /></button>
                                <button onClick={() => handleDeleteAssetCategory(cat.id)} className="text-red-600 hover:text-red-900 dark:text-red-400"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assets' && showAssetTypeModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
                  <h3 className="text-white font-bold text-lg">
                    {editingAssetType ? 'Modifier le Type' : 'Ajouter un Type'}
                  </h3>
                  <button onClick={() => setShowAssetTypeModal(false)} className="text-blue-100 hover:text-white transition-colors">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">ID (Clé unique)</label>
                      <input
                        type="number"
                        disabled={!!editingAssetType}
                        value={editingAssetType?.id || newAssetType.id}
                        onChange={(e) => setNewAssetType({ ...newAssetType, id: parseInt(e.target.value) || 0 })}
                        placeholder="ex: 10"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nom</label>
                      <input
                        type="text"
                        value={editingAssetType ? editingAssetType.name : newAssetType.name}
                        onChange={(e) => editingAssetType ? setEditingAssetType({ ...editingAssetType, name: e.target.value }) : setNewAssetType({ ...newAssetType, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Description</label>
                    <textarea
                      value={editingAssetType ? editingAssetType.description : newAssetType.description}
                      onChange={(e) => editingAssetType ? setEditingAssetType({ ...editingAssetType, description: e.target.value }) : setNewAssetType({ ...newAssetType, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-sm h-20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Catégorie</label>
                      <select
                        value={editingAssetType ? editingAssetType.id_categorie : newAssetType.id_categorie}
                        onChange={(e) => editingAssetType ? setEditingAssetType({ ...editingAssetType, id_categorie: parseInt(e.target.value) }) : setNewAssetType({ ...newAssetType, id_categorie: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-sm"
                      >
                        {assetCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.categorie}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Icône / Couleur</label>
                      <div className="flex items-center gap-2">
                        <select
                          value={editingAssetType ? editingAssetType.icon : newAssetType.icon}
                          onChange={(e) => editingAssetType ? setEditingAssetType({ ...editingAssetType, icon: e.target.value }) : setNewAssetType({ ...newAssetType, icon: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-sm text-xs"
                        >
                          {ICON_GROUPS.map(group => (
                            <optgroup key={group.label} label={group.label}>
                              {group.icons.map(icon => (
                                <option key={icon.id} value={icon.id}>{icon.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <input
                          type="color"
                          value={editingAssetType ? editingAssetType.color : newAssetType.color}
                          onChange={(e) => editingAssetType ? setEditingAssetType({ ...editingAssetType, color: e.target.value }) : setNewAssetType({ ...newAssetType, color: e.target.value })}
                          className="w-10 h-10 p-1 border border-gray-300 dark:border-gray-600 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => setShowAssetTypeModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Annuler</button>
                    <button onClick={handleSaveAssetType} className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md">Enregistrer</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assets' && showAssetCategoryModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex justify-between items-center">
                  <h3 className="text-white font-bold text-lg">
                    {editingAssetCategory ? 'Modifier la Catégorie' : 'Ajouter une Catégorie'}
                  </h3>
                  <button onClick={() => setShowAssetCategoryModal(false)} className="text-indigo-100 hover:text-white transition-colors">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nom de la Catégorie</label>
                    <input
                      type="text"
                      value={editingAssetCategory ? editingAssetCategory.categorie : newAssetCategory.categorie}
                      onChange={(e) => editingAssetCategory ? setEditingAssetCategory({ ...editingAssetCategory, categorie: e.target.value }) : setNewAssetCategory({ ...newAssetCategory, categorie: e.target.value })}
                      placeholder="ex: Médicament"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => setShowAssetCategoryModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Annuler</button>
                    <button onClick={handleSaveAssetCategory} className="px-6 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md">Enregistrer</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('admin.permissions.title')}
              </h3>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modules.map((module) => (
                    <div key={module.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        {module.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {module.description}
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t('admin.permissions.authorizedUsers')}: {users.filter(u => u.modules.includes(module.id)).length}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}



          {activeTab === 'floors_rooms' && (
            <div className="space-y-6">
              {/* Etages */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.floors.title')}</h3>
                  <button
                    onClick={() => setShowFloorModal(true)}
                    className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('admin.floors.addFloor')}</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.name')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.description')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {loadingFloors ? (
                        <tr><td colSpan={3} className="px-6 py-4 text-center">{t('common.loading')}</td></tr>
                      ) : floors.map((floor) => (
                        <tr
                          key={floor.id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${selectedFloorForRooms == floor.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                          onClick={() => setSelectedFloorForRooms(floor.id)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white font-medium">{floor.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{floor.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              {/* Corridor Button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditCorridor(floor); }}
                                className="text-purple-600 hover:text-purple-900 dark:text-purple-400"
                                title={t('admin.floors.editCorridor')}
                              >
                                <MapIcon className="h-4 w-4" />
                              </button>
                              {/* Trajet Button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditTrajet(floor); }}
                                className="text-green-600 hover:text-green-900 dark:text-green-400"
                                title={t('admin.floors.editTrajectory')}
                              >
                                <Layout className="h-4 w-4" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setEditingFloor(floor); setShowFloorModal(true); }} className="text-blue-600 hover:text-blue-900 dark:text-blue-400" title={t('common.edit')}><Edit className="h-4 w-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteFloor(floor.id); }} className="text-red-600 hover:text-red-900 dark:text-red-400" title={t('common.delete')}><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <hr className="border-gray-200 dark:border-gray-700" />

              {/* Chambres */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.rooms.title')}</h3>
                  <div className="flex items-center space-x-4">
                    <select
                      value={selectedFloorForRooms}
                      onChange={(e) => setSelectedFloorForRooms(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <button
                      onClick={() => {
                        setNewRoom({ ...newRoom, floor_id: Number(selectedFloorForRooms) });
                        setShowRoomModal(true);
                      }}
                      className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t('admin.rooms.addRoom')}</span>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.rooms.roomNumber')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.type')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.rooms.zone')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {rooms.length === 0 ? (
                        <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">{t('admin.rooms.noRoomsForFloor')}</td></tr>
                      ) : rooms.map((room) => (
                        <tr key={room.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <BedDouble className="h-4 w-4 text-blue-500" />
                              <span className="font-medium text-gray-900 dark:text-white">{room.room_number}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400 capitalize">{room.type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs ${room.polygon ? 'text-green-600' : 'text-gray-400'}`}>
                                {room.polygon ? t('admin.rooms.geofenceDefined') : t('admin.rooms.geofenceNotDefined')}
                              </span>
                              <button
                                onClick={() => setGeofenceRoom(room)}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                title={t('admin.rooms.defineZone')}
                              >
                                <MapIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button onClick={() => { setEditingRoom(room); setShowRoomModal(true); }} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDeleteRoom(room.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'zones' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.zones.title')}</h3>
                <button
                  onClick={() => {
                    setShowZoneModal(true);
                  }}
                  className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('admin.zones.addZone')}</span>
                </button>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.zones.name')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.description')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.zones.floor')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.zones.geofence')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {loadingZones ? (
                      <tr><td colSpan={3} className="px-6 py-4 text-center">{t('common.loading')}</td></tr>
                    ) : zones.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">{t('admin.zones.noZones')}</td></tr>
                    ) : zones.map((zone) => (
                      <tr key={zone.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Grid className="h-4 w-4 text-indigo-500" />
                            <span className="font-medium text-gray-900 dark:text-white">{zone.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{zone.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                          {zone.floor_name || t('common.all')} {zone.floor_description ? `(${zone.floor_description})` : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {zone.polygon ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              {t('admin.zones.defined')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                              {t('admin.zones.notDefined')}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button onClick={() => { setEditingZone(zone); setShowZoneModal(true); }} className="text-blue-600 hover:text-blue-900 dark:text-blue-400">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteZone(zone.id)} className="text-red-600 hover:text-red-900 dark:text-red-400">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'sirens' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admin.sirens.title')}</h3>
                <button
                  onClick={() => {
                    setEditingSiren(null);
                    setNewSiren({ mac: '', name: '', designation: '', geofence: '', output_channel: 'state1', floor_id: 1 });
                    setShowSirenModal(true);
                  }}
                  className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('admin.sirens.addSiren')}</span>
                </button>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.sirens.mac')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.sirens.name')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.sirens.designation')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.sirens.channel')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.sirens.geofence')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {loadingSirens ? (
                      <tr><td colSpan={5} className="px-6 py-4 text-center">Chargement...</td></tr>
                    ) : sirens.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Aucune sirène définie.</td></tr>
                    ) : sirens.map((siren) => (
                      <tr key={siren.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-500 dark:text-gray-400">{siren.mac}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Megaphone className="h-4 w-4 text-indigo-500" />
                            <span className="font-medium text-gray-900 dark:text-white">{siren.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{siren.designation}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${siren.output_channel === 'state2' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                            {siren.output_channel === 'state2' ? t('admin.sirens.output2') : t('admin.sirens.output1')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400 truncate max-w-xs" title={siren.geofence}>{siren.geofence}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button onClick={() => { setEditingSiren(siren); setShowSirenModal(true); }} className="text-blue-600 hover:text-blue-900 dark:text-blue-400">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteSiren(siren.id)} className="text-red-600 hover:text-red-900 dark:text-red-400">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'equipment' && (
            <div className="space-y-6">
              {/* Equipment Sub-tabs */}
              <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto">
                {[
                  { id: 'oxygen', label: t('admin.equipment.tabs.oxygen'), icon: Activity },
                  { id: 'energy', label: t('admin.equipment.tabs.energy'), icon: Zap },
                  { id: 'air', label: t('admin.equipment.tabs.air'), icon: Wind },
                  { id: 'ambulance', label: t('admin.equipment.tabs.ambulance'), icon: Ambulance },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveEquipTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeEquipTab === tab.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Content Areas */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                {/* Energy Sub-tabs level 2 */}
                {activeEquipTab === 'energy' && (
                  <div className="px-4 pt-4 flex space-x-4 border-b border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => setActiveEnergySubTab('meters')}
                      className={`pb-2 text-sm font-bold transition-all ${activeEnergySubTab === 'meters'
                        ? 'border-b-2 border-[#0096D6] text-[#0096D6]'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {t('admin.equipment.tabs.energyMeters')}
                    </button>
                    <button
                      onClick={() => setActiveEnergySubTab('settings')}
                      className={`pb-2 text-sm font-bold transition-all ${activeEnergySubTab === 'settings'
                        ? 'border-b-2 border-[#0096D6] text-[#0096D6]'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                      {t('admin.equipment.tabs.energySettings')}
                    </button>
                  </div>
                )}

                {/* Header with Title and Add Button - Only for lists, not settings */}
                {!(activeEquipTab === 'energy' && activeEnergySubTab === 'settings') && (
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {activeEquipTab === 'oxygen' && t('admin.equipment.titles.oxygen')}
                      {activeEquipTab === 'energy' && (activeEnergySubTab === 'meters' ? t('admin.equipment.titles.energy') : t('admin.equipment.titles.energySettings'))}
                      {activeEquipTab === 'air' && t('admin.equipment.titles.air')}
                      {activeEquipTab === 'ambulance' && t('admin.equipment.titles.ambulance')}
                    </h3>
                    <button
                      onClick={() => {
                        if (activeEquipTab === 'oxygen') { setEditingOxygen(null); setShowOxygenModal(true); }
                        if (activeEquipTab === 'energy') { setEditingEnergy(null); setShowEnergyModal(true); }
                        if (activeEquipTab === 'air') { setEditingAir(null); setShowAirModal(true); }
                        if (activeEquipTab === 'ambulance') { setEditingAmbulance(null); setShowAmbulanceModal(true); }
                      }}
                      className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                )}

                {/* Table Content */}
                <div className="overflow-x-auto">
                  {activeEquipTab === 'energy' && activeEnergySubTab === 'settings' ? (
                    <div className="p-6">
                      <EnergySettings />
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          {activeEquipTab === 'ambulance' ? (
                            <>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plaque</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.equipment.ambulance.imeiTab')}</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.equipment.ambulance.imeiGps')}</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admin.equipment.ambulance.level')}</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Capacité</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actif</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </>
                          ) : (
                            <>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('common.name')}
                              </th>
                              {activeEquipTab === 'energy' && (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Designation
                                </th>
                              )}
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('common.floor')}
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('common.status')}
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {activeEquipTab === 'oxygen' && oxygenPoints.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{item.id || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{item.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{t('admin.users.floorN', { n: item.floor_id })}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {item.is_active ? t('common.active') : t('common.inactive')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button onClick={() => { setEditingOxygen(item); setShowOxygenModal(true); }} className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button>
                                <button onClick={() => handleDeleteOxygen(item.id)} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {activeEquipTab === 'energy' && energyMeters.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{item.id || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{item.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{item.designation || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{t('admin.users.floorN', { n: item.floor_id })}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {item.is_active ? t('common.active') : t('common.inactive')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button onClick={() => { setEditingEnergy(item); setShowEnergyModal(true); }} className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button>
                                <button onClick={() => handleDeleteEnergy(item.id)} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {activeEquipTab === 'air' && airSensors.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{item.id || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{item.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{t('admin.users.floorN', { n: item.floor_id })}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {item.is_active ? t('common.active') : t('common.inactive')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button onClick={() => { setEditingAir(item); setShowAirModal(true); }} className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button>
                                <button onClick={() => handleDeleteAir(item.id)} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {activeEquipTab === 'ambulance' && ambulances.map((amb) => (
                          <tr key={amb.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{amb.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{amb.license_plate}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{amb.imei_tablette || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{amb.imei_gps || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                              {amb.equipment_level === 'basic' && 'BLS (Basic)'}
                              {amb.equipment_level === 'intermediate' && 'ILS (Inter.)'}
                              {amb.equipment_level === 'advanced' && 'ALS (Advanced)'}
                              {!['basic', 'intermediate', 'advanced'].includes(amb.equipment_level) && (amb.equipment_level || '-')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{amb.crew_capacity || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${amb.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {amb.is_active ? t('common.active') : t('common.inactive')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button onClick={() => { setEditingAmbulance(amb); setShowAmbulanceModal(true); }} className="text-blue-600 hover:text-blue-900"><Edit className="h-4 w-4" /></button>
                                <button onClick={() => handleDeleteAmbulance(amb.id)} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {!loadingEquip && (
                    (activeEquipTab === 'oxygen' && oxygenPoints.length === 0) ||
                    (activeEquipTab === 'energy' && energyMeters.length === 0) ||
                    (activeEquipTab === 'air' && airSensors.length === 0) ||
                    (activeEquipTab === 'ambulance' && ambulances.length === 0)
                  ) && (
                      <div className="p-8 text-center text-gray-500">Aucun équipement trouvé.</div>
                    )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-4">
              {/* System content */}
            </div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {/* ... (existing user modal) ... */}

      {/* Existing Modals ... */}

      {/* User Modal */}
      {
        showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingUser ? t('admin.users.editUser') : t('admin.users.addUser')}
                </h3>
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setEditingUser(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.users.fullName')}
                  </label>
                  <input
                    type="text"
                    value={editingUser?.name || newUser.name}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, name: e.target.value })
                      : setNewUser({ ...newUser, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.users.email')}
                  </label>
                  <input
                    type="email"
                    value={editingUser?.email || newUser.email}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, email: e.target.value })
                      : setNewUser({ ...newUser, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('admin.users.password')}
                    </label>
                    <input
                      type="password"
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder={t('admin.users.passwordPlaceholder')}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.users.role')}
                  </label>
                  <select
                    value={editingUser?.role || newUser.role}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, role: e.target.value as any })
                      : setNewUser({ ...newUser, role: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                    <option value="guest">Invité</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.users.mainFloor')}
                  </label>
                  <select
                    value={editingUser?.floor ?? newUser.floor}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, floor: parseInt(e.target.value) })
                      : setNewUser({ ...newUser, floor: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={0}>{t('admin.users.allFloors')}</option>
                    {floors.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.description ? `- ${f.description}` : ''}
                      </option>
                    ))}
                    {floors.length === 0 && [1, 2, 3, 4, 5, 6, 7, 8].map(floor => (
                      <option key={floor} value={floor}>{t('admin.users.floorN', { n: floor })}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.users.modulesAuthorized')}
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {modules.map((module) => (
                      <label key={module.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={(editingUser?.modules || newUser.modules || []).includes(module.id)}
                          onChange={(e) => {
                            const currentModules = editingUser?.modules || newUser.modules || [];
                            const newModules = e.target.checked
                              ? [...currentModules, module.id]
                              : currentModules.filter(m => m !== module.id);

                            if (editingUser) {
                              setEditingUser({ ...editingUser, modules: newModules });
                            } else {
                              setNewUser({ ...newUser, modules: newModules });
                            }
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {module.name} - {module.description}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowUserModal(false);
                      setEditingUser(null);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSaveUser}
                    className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200"
                  >
                    <Save className="h-4 w-4" />
                    <span>{t('common.save')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Asset Modal */}
      {
        showAssetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingAsset ? t('admin.assets.editAsset') : t('admin.assets.addAsset')}
                </h3>
                <button
                  onClick={() => {
                    setShowAssetModal(false);
                    setEditingAsset(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.assets.tagIdLabel')}
                  </label>
                  <input
                    type="text"
                    value={editingAsset?.id || newAsset.id || ''}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase(); // Force lowercase
                      if (!editingAsset) {
                        setNewAsset({ ...newAsset, id: val });
                      }
                    }}
                    disabled={!!editingAsset}
                    placeholder={t('admin.assets.tagPlaceholder')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${editingAsset
                      ? 'border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-75'
                      : 'border-gray-300 dark:border-gray-600'
                      }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('common.name')}
                  </label>
                  <input
                    type="text"
                    value={editingAsset?.name || newAsset.name}
                    onChange={(e) => editingAsset
                      ? setEditingAsset({ ...editingAsset, name: e.target.value })
                      : setNewAsset({ ...newAsset, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('common.type')}
                  </label>
                  <select
                    value={editingAsset?.type_id || newAsset.type_id}
                    onChange={(e) => {
                      const newType = e.target.value;
                      const selectedTypeObj = assetTypes.find(t => String(t.id) === String(newType));
                      const newCategory = selectedTypeObj?.id_categorie || selectedTypeObj?.category_name || 2;

                      if (editingAsset) {
                        setEditingAsset({ ...editingAsset, type_id: isNaN(Number(newType)) ? newType : Number(newType), category: newCategory });
                      } else {
                        setNewAsset({ ...newAsset, type_id: isNaN(Number(newType)) ? newType : Number(newType), category: newCategory });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {assetTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin.assets.initialFloor')}
                  </label>
                  <select
                    value={editingAsset?.floor_id ?? newAsset.floor_id}
                    onChange={(e) => editingAsset
                      ? setEditingAsset({ ...editingAsset, floor_id: parseInt(e.target.value) })
                      : setNewAsset({ ...newAsset, floor_id: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {floors.map(floor => (
                      <option key={floor.id} value={floor.id}>
                        {floor.name} {floor.description ? `- ${floor.description}` : ''}
                      </option>
                    ))}
                    {floors.length === 0 && [1, 2, 3, 4].map(floor => (
                      <option key={floor} value={floor}>{t('admin.assets.floorN', { n: floor })}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAssetModal(false);
                      setEditingAsset(null);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleSaveAsset}
                    className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200"
                  >
                    <Save className="h-4 w-4" />
                    <span>{t('common.save')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Zone Modal */}
      {
        showZoneModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{editingZone ? t('admin.zones.editZone') : t('admin.zones.addZone')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
                  <input type="text" value={editingZone?.name || newZone.name} onChange={(e) => editingZone ? setEditingZone({ ...editingZone, name: e.target.value }) : setNewZone({ ...newZone, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.description')}</label>
                  <input type="text" value={editingZone?.description || newZone.description} onChange={(e) => editingZone ? setEditingZone({ ...editingZone, description: e.target.value }) : setNewZone({ ...newZone, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.floor')}</label>
                  <select
                    value={editingZone?.floor_id ?? newZone.floor_id}
                    onChange={(e) => editingZone ? setEditingZone({ ...editingZone, floor_id: parseInt(e.target.value) }) : setNewZone({ ...newZone, floor_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {floors.map(f => (
                      <option key={f.id} value={f.id}>{f.name} {f.description ? `- ${f.description}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.zones.geofenceLabel')}</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={editingZone?.polygon || newZone.polygon}
                      className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white bg-gray-50 cursor-not-allowed"
                      placeholder={t('admin.zones.defineOnMap')}
                    />
                    <button
                      onClick={() => setGeofenceZone(editingZone || newZone)}
                      className="px-3 py-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                      title={t('admin.zones.drawOnMap')}
                    >
                      <MapIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button onClick={() => { setShowZoneModal(false); setEditingZone(null); }} className="px-4 py-2 text-gray-700 dark:text-gray-300">{t('common.cancel')}</button>
                  <button onClick={handleSaveZone} className="bg-[#0096D6] text-white px-4 py-2 rounded-lg hover:bg-[#007BB5] transition-colors">{t('common.save')}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Floor Modal */}
      {
        showFloorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{editingFloor ? t('admin.floors.editFloor') : t('admin.floors.addFloor')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
                  <input type="text" value={editingFloor?.name || newFloor.name} onChange={(e) => editingFloor ? setEditingFloor({ ...editingFloor, name: e.target.value }) : setNewFloor({ ...newFloor, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.description')}</label>
                  <input type="text" value={editingFloor?.description || newFloor.description} onChange={(e) => editingFloor ? setEditingFloor({ ...editingFloor, description: e.target.value }) : setNewFloor({ ...newFloor, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button onClick={() => { setShowFloorModal(false); setEditingFloor(null); }} className="px-4 py-2 text-gray-700 dark:text-gray-300">{t('common.cancel')}</button>
                  <button onClick={handleSaveFloor} className="bg-[#0096D6] text-white px-4 py-2 rounded-lg">{t('common.save')}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Room Modal */}
      {
        showRoomModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{editingRoom ? t('admin.rooms.editRoom') : t('admin.rooms.addRoom')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.rooms.roomNumber')}</label>
                  <input type="text" value={editingRoom?.room_number || newRoom.room_number} onChange={(e) => editingRoom ? setEditingRoom({ ...editingRoom, room_number: e.target.value }) : setNewRoom({ ...newRoom, room_number: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.floor')}</label>
                  <select value={editingRoom?.floor_id ?? newRoom.floor_id} onChange={(e) => editingRoom ? setEditingRoom({ ...editingRoom, floor_id: Number(e.target.value) }) : setNewRoom({ ...newRoom, floor_id: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    {floors.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.description ? `- ${f.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.type')}</label>
                  <select value={editingRoom?.type || newRoom.type} onChange={(e) => editingRoom ? setEditingRoom({ ...editingRoom, type: e.target.value }) : setNewRoom({ ...newRoom, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="standard">{t('admin.rooms.types.standard')}</option>
                    <option value="soins_intensifs">{t('admin.rooms.types.intensiveCare')}</option>
                    <option value="operating">{t('admin.rooms.types.operating')}</option>
                    <option value="suite">{t('admin.rooms.types.suite')}</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button onClick={() => { setShowRoomModal(false); setEditingRoom(null); }} className="px-4 py-2 text-gray-700 dark:text-gray-300">{t('common.cancel')}</button>
                  <button onClick={handleSaveRoom} className="bg-[#0096D6] text-white px-4 py-2 rounded-lg hover:bg-[#007BB5] transition-colors">{t('common.save')}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {/* Siren Modal */}
      {
        showSirenModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{editingSiren ? t('admin.sirens.editSiren') : t('admin.sirens.addSiren')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.sirens.mac')}</label>
                  <input type="text" value={editingSiren?.mac || newSiren.mac} onChange={(e) => editingSiren ? setEditingSiren({ ...editingSiren, mac: e.target.value }) : setNewSiren({ ...newSiren, mac: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
                  <input type="text" value={editingSiren?.name || newSiren.name} onChange={(e) => editingSiren ? setEditingSiren({ ...editingSiren, name: e.target.value }) : setNewSiren({ ...newSiren, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.sirens.designation')}</label>
                  <input type="text" value={editingSiren?.designation || newSiren.designation} onChange={(e) => editingSiren ? setEditingSiren({ ...editingSiren, designation: e.target.value }) : setNewSiren({ ...newSiren, designation: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.sirens.outputChannel')}</label>
                  <select
                    value={editingSiren?.output_channel || newSiren.output_channel || 'state1'}
                    onChange={(e) => editingSiren ? setEditingSiren({ ...editingSiren, output_channel: e.target.value }) : setNewSiren({ ...newSiren, output_channel: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="state1">{t('admin.sirens.output1Desc')}</option>
                    <option value="state2">{t('admin.sirens.output2Desc')}</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">{t('admin.sirens.outputChannelHint')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.zones.geofenceLabel')}</label>
                  <div className="flex space-x-2">
                    <input type="text" value={editingSiren?.geofence || newSiren.geofence} onChange={(e) => editingSiren ? setEditingSiren({ ...editingSiren, geofence: e.target.value }) : setNewSiren({ ...newSiren, geofence: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="((x1,y1),(x2,y2)...)" />
                    <button
                      onClick={() => setShowGeofenceEditor(true)}
                      className="px-3 py-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                      title={t('admin.zones.drawOnMap')}
                    >
                      <MapIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button onClick={() => { setShowSirenModal(false); setEditingSiren(null); }} className="px-4 py-2 text-gray-700 dark:text-gray-300">{t('common.cancel')}</button>
                  <button onClick={handleSaveSiren} className="bg-[#0096D6] text-white px-4 py-2 rounded-lg hover:bg-[#007BB5] transition-colors">{t('common.save')}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Oxygen Modal */}
      {
        showOxygenModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{editingOxygen ? t('admin.equipment.editOxygen') : t('admin.equipment.addOxygen')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
                  <input type="text" value={editingOxygen?.name || newOxygen.name} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, name: e.target.value }) : setNewOxygen({ ...newOxygen, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.floor')}</label>
                  <select
                    value={editingOxygen?.floor_id ?? newOxygen.floor_id}
                    onChange={(e) => {
                      const floorId = Number(e.target.value);
                      if (editingOxygen) {
                        setEditingOxygen({ ...editingOxygen, floor_id: floorId, room_id: null });
                      } else {
                        setNewOxygen({ ...newOxygen, floor_id: floorId, room_id: null });
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {floors.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.description ? `- ${f.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.zone')}</label>
                  <input type="text" value={editingOxygen?.zone || newOxygen.zone} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, zone: e.target.value }) : setNewOxygen({ ...newOxygen, zone: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.location')}</label>
                  <input type="text" value={editingOxygen?.location || newOxygen.location} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, location: e.target.value }) : setNewOxygen({ ...newOxygen, location: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>

                {/* Technical Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.type')}</label>
                  <select value={editingOxygen?.point_type || newOxygen.point_type} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, point_type: e.target.value }) : setNewOxygen({ ...newOxygen, point_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="outlet">Outlet (Prise)</option>
                    <option value="valve">Vanne de distribution</option>
                    <option value="sensor">Capteur</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">MAC / ID Appareil</label>
                  <input type="text" value={editingOxygen?.mac || newOxygen.mac} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, mac: e.target.value }) : setNewOxygen({ ...newOxygen, mac: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="XX:XX:XX:XX:XX:XX" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chambre (Lien direct)</label>
                  <select value={editingOxygen?.room_id || ''} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, room_id: e.target.value ? Number(e.target.value) : null }) : setNewOxygen({ ...newOxygen, room_id: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="">-- Sélectionner une chambre --</option>
                    {rooms.filter(r => r.floor_id === (editingOxygen?.floor_id || newOxygen.floor_id)).map(r => (
                      <option key={r.id} value={r.id}>{r.room_number}</option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.installationDate')}</label>
                  <input type="date" value={(editingOxygen?.installation_date ? (typeof editingOxygen.installation_date === 'string' ? editingOxygen.installation_date : new Date(editingOxygen.installation_date).toISOString()).split('T')[0] : newOxygen.installation_date) || ''} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, installation_date: e.target.value }) : setNewOxygen({ ...newOxygen, installation_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.lastMaintenance')}</label>
                  <input type="date" value={(editingOxygen?.last_maintenance ? (typeof editingOxygen.last_maintenance === 'string' ? editingOxygen.last_maintenance : new Date(editingOxygen.last_maintenance).toISOString()).split('T')[0] : newOxygen.last_maintenance) || ''} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, last_maintenance: e.target.value }) : setNewOxygen({ ...newOxygen, last_maintenance: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prochaine Maintenance</label>
                  <input type="date" value={(editingOxygen?.next_maintenance ? (typeof editingOxygen.next_maintenance === 'string' ? editingOxygen.next_maintenance : new Date(editingOxygen.next_maintenance).toISOString()).split('T')[0] : newOxygen.next_maintenance) || ''} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, next_maintenance: e.target.value }) : setNewOxygen({ ...newOxygen, next_maintenance: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>

                {/* Status */}
                <div className="flex items-center space-x-3 pt-4">
                  <input type="checkbox" checked={editingOxygen?.is_active ?? newOxygen.is_active} onChange={(e) => editingOxygen ? setEditingOxygen({ ...editingOxygen, is_active: e.target.checked }) : setNewOxygen({ ...newOxygen, is_active: e.target.checked })} className="h-4 w-4 text-[#0096D6] border-gray-300 rounded" />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.equipment.modal.active')}</label>
                </div>

                <div className="col-span-1 md:col-span-2 flex justify-end space-x-3 pt-4 border-t dark:border-gray-700 mt-4">
                  <button onClick={() => { setShowOxygenModal(false); setEditingOxygen(null); }} className="px-4 py-2 text-gray-700 dark:text-gray-300">{t('common.cancel')}</button>
                  <button onClick={handleSaveOxygen} className="bg-[#0096D6] text-white px-4 py-2 rounded-lg font-medium">{t('common.save')}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Energy Modal */}
      {
        showEnergyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{editingEnergy ? t('admin.equipment.modal.editEnergy') : t('admin.equipment.modal.newEnergy')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
                  <input type="text" value={editingEnergy?.name || newEnergy.name} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, name: e.target.value }) : setNewEnergy({ ...newEnergy, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.designation')}</label>
                  <input type="text" value={editingEnergy?.designation || newEnergy.designation} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, designation: e.target.value }) : setNewEnergy({ ...newEnergy, designation: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.type')}</label>
                  <select value={editingEnergy?.meter_type || newEnergy.meter_type} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, meter_type: e.target.value }) : setNewEnergy({ ...newEnergy, meter_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="compteur">{t('admin.equipment.energyTypes.compteur')}</option>
                    <option value="analyseur">{t('admin.equipment.energyTypes.analyseur')}</option>
                    <option value="disjoncteur">{t('admin.equipment.energyTypes.disjoncteur')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.floor')}</label>
                  <select value={editingEnergy?.floor_id ?? newEnergy.floor_id} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, floor_id: Number(e.target.value) }) : setNewEnergy({ ...newEnergy, floor_id: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    {floors.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.description ? `- ${f.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.zone')}</label>
                  <input type="text" value={editingEnergy?.zone || newEnergy.zone} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, zone: e.target.value }) : setNewEnergy({ ...newEnergy, zone: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.maxCapacity')}</label>
                  <input type="number" value={editingEnergy?.max_capacity_kw ?? newEnergy.max_capacity_kw} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, max_capacity_kw: Number(e.target.value) }) : setNewEnergy({ ...newEnergy, max_capacity_kw: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>

                {/* Technical Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.deviceId')}</label>
                  <input type="text" value={editingEnergy?.device || newEnergy.device} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, device: e.target.value }) : setNewEnergy({ ...newEnergy, device: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.channel')}</label>
                  <input type="text" value={editingEnergy?.channel || newEnergy.channel} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, channel: e.target.value }) : setNewEnergy({ ...newEnergy, channel: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.cable')}</label>
                  <input type="text" value={editingEnergy?.cable || newEnergy.cable} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, cable: e.target.value }) : setNewEnergy({ ...newEnergy, cable: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.ctCurrent')}</label>
                  <input type="number" value={editingEnergy?.ctcurrent ?? newEnergy.ctcurrent} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, ctcurrent: Number(e.target.value) }) : setNewEnergy({ ...newEnergy, ctcurrent: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>

                {/* Dates */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.installationDate')}</label>
                  <input type="date" value={(editingEnergy?.installation_date ? (typeof editingEnergy.installation_date === 'string' ? editingEnergy.installation_date : new Date(editingEnergy.installation_date).toISOString()).split('T')[0] : newEnergy.installation_date) || ''} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, installation_date: e.target.value }) : setNewEnergy({ ...newEnergy, installation_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.modal.lastMaintenance')}</label>
                  <input type="date" value={(editingEnergy?.last_maintenance ? (typeof editingEnergy.last_maintenance === 'string' ? editingEnergy.last_maintenance : new Date(editingEnergy.last_maintenance).toISOString()).split('T')[0] : newEnergy.last_maintenance) || ''} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, last_maintenance: e.target.value }) : setNewEnergy({ ...newEnergy, last_maintenance: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>

                {/* Status */}
                <div className="flex items-center space-x-3 pt-4">
                  <input type="checkbox" checked={editingEnergy?.is_active ?? newEnergy.is_active} onChange={(e) => editingEnergy ? setEditingEnergy({ ...editingEnergy, is_active: e.target.checked }) : setNewEnergy({ ...newEnergy, is_active: e.target.checked })} className="h-4 w-4 text-[#0096D6] border-gray-300 rounded" />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.equipment.modal.active')}</label>
                </div>

                <div className="col-span-1 md:col-span-2 flex justify-end space-x-3 pt-4 border-t dark:border-gray-700 mt-4">
                  <button onClick={() => { setShowEnergyModal(false); setEditingEnergy(null); }} className="px-4 py-2 text-gray-700 dark:text-gray-300">{t('common.cancel')}</button>
                  <button onClick={handleSaveEnergy} className="bg-[#0096D6] text-white px-4 py-2 rounded-lg font-medium">{t('common.save')}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Air Modal */}
      {
        showAirModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{editingAir ? t('admin.equipment.editAir') : t('admin.equipment.addAir')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
                  <input type="text" value={editingAir?.name || newAir.name} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, name: e.target.value }) : setNewAir({ ...newAir, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>



                {/* Threshold Configuration Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Configuration des Seuils (Min/Max ou Max)</h4>
                  <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-2">

                    {/* Temperature */}
                    <div className="col-span-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Température (°C)</label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <span className="text-xs text-orange-500">Min Warning</span>
                          <input type="number" step="0.1" value={editingAir?.temp_min_warning ?? newAir.temp_min_warning} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, temp_min_warning: Number(e.target.value) }) : setNewAir({ ...newAir, temp_min_warning: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                        <div>
                          <span className="text-xs text-orange-500">Max Warning</span>
                          <input type="number" step="0.1" value={editingAir?.temp_max_warning ?? newAir.temp_max_warning} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, temp_max_warning: Number(e.target.value) }) : setNewAir({ ...newAir, temp_max_warning: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs text-red-500">Min Critical</span>
                          <input type="number" step="0.1" value={editingAir?.temp_min_critical ?? newAir.temp_min_critical} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, temp_min_critical: Number(e.target.value) }) : setNewAir({ ...newAir, temp_min_critical: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                        <div>
                          <span className="text-xs text-red-500">Max Critical</span>
                          <input type="number" step="0.1" value={editingAir?.temp_max_critical ?? newAir.temp_max_critical} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, temp_max_critical: Number(e.target.value) }) : setNewAir({ ...newAir, temp_max_critical: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                      </div>
                    </div>

                    {/* Humidity */}
                    <div className="col-span-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Humidité (%)</label>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <span className="text-xs text-orange-500">Min Warning</span>
                          <input type="number" step="1" value={editingAir?.hum_min_warning ?? newAir.hum_min_warning} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, hum_min_warning: Number(e.target.value) }) : setNewAir({ ...newAir, hum_min_warning: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                        <div>
                          <span className="text-xs text-orange-500">Max Warning</span>
                          <input type="number" step="1" value={editingAir?.hum_max_warning ?? newAir.hum_max_warning} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, hum_max_warning: Number(e.target.value) }) : setNewAir({ ...newAir, hum_max_warning: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs text-red-500">Min Critical</span>
                          <input type="number" step="1" value={editingAir?.hum_min_critical ?? newAir.hum_min_critical} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, hum_min_critical: Number(e.target.value) }) : setNewAir({ ...newAir, hum_min_critical: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                        <div>
                          <span className="text-xs text-red-500">Max Critical</span>
                          <input type="number" step="1" value={editingAir?.hum_max_critical ?? newAir.hum_max_critical} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, hum_max_critical: Number(e.target.value) }) : setNewAir({ ...newAir, hum_max_critical: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                      </div>
                    </div>

                    {/* PM2.5 */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">PM2.5 (µg/m³)</label>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-orange-500">Warning Max</span>
                          <input type="number" step="0.1" value={editingAir?.pm25_warning ?? newAir.pm25_warning} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, pm25_warning: Number(e.target.value) }) : setNewAir({ ...newAir, pm25_warning: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                        <div>
                          <span className="text-xs text-red-500">Critical Max</span>
                          <input type="number" step="0.1" value={editingAir?.pm25_critical ?? newAir.pm25_critical} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, pm25_critical: Number(e.target.value) }) : setNewAir({ ...newAir, pm25_critical: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                      </div>
                    </div>

                    {/* TVOC */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">TVOC (ppb)</label>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-orange-500">Warning Max</span>
                          <input type="number" step="1" value={editingAir?.tvoc_warning ?? newAir.tvoc_warning} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, tvoc_warning: Number(e.target.value) }) : setNewAir({ ...newAir, tvoc_warning: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                        <div>
                          <span className="text-xs text-red-500">Critical Max</span>
                          <input type="number" step="1" value={editingAir?.tvoc_critical ?? newAir.tvoc_critical} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, tvoc_critical: Number(e.target.value) }) : setNewAir({ ...newAir, tvoc_critical: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                      </div>
                    </div>

                    {/* CO2 */}
                    <div className="col-span-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">CO2 (ppm)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs text-orange-500">Warning Max</span>
                          <input type="number" step="1" value={editingAir?.co2_warning ?? newAir.co2_warning} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, co2_warning: Number(e.target.value) }) : setNewAir({ ...newAir, co2_warning: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                        <div>
                          <span className="text-xs text-red-500">Critical Max</span>
                          <input type="number" step="1" value={editingAir?.co2_critical ?? newAir.co2_critical} onChange={(e) => editingAir ? setEditingAir({ ...editingAir, co2_critical: Number(e.target.value) }) : setNewAir({ ...newAir, co2_critical: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border rounded mt-1" />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button onClick={() => { setShowAirModal(false); setEditingAir(null); }} className="px-4 py-2 text-gray-700 dark:text-gray-300">{t('common.cancel')}</button>
                  <button onClick={handleSaveAir} className="bg-[#0096D6] text-white px-4 py-2 rounded-lg">{t('common.save')}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }


      {/* Ambulance Modal */}
      {
        showAmbulanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{editingAmbulance ? t('admin.equipment.editAmbulance') : t('admin.equipment.addAmbulance')}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.ambulance.callSign')}</label>
                    <input type="text" value={editingAmbulance?.call_sign || newAmbulance.call_sign} onChange={(e) => editingAmbulance ? setEditingAmbulance({ ...editingAmbulance, call_sign: e.target.value }) : setNewAmbulance({ ...newAmbulance, call_sign: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.ambulance.plate')}</label>
                    <input type="text" value={editingAmbulance?.license_plate || newAmbulance.license_plate} onChange={(e) => editingAmbulance ? setEditingAmbulance({ ...editingAmbulance, license_plate: e.target.value }) : setNewAmbulance({ ...newAmbulance, license_plate: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingAmbulance ? editingAmbulance.is_active : newAmbulance.is_active}
                      onChange={(e) => editingAmbulance
                        ? setEditingAmbulance({ ...editingAmbulance, is_active: e.target.checked })
                        : setNewAmbulance({ ...newAmbulance, is_active: e.target.checked })
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Actif</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.ambulance.capacity')}</label>
                    <input type="number" value={editingAmbulance?.crew_capacity || newAmbulance.crew_capacity} onChange={(e) => editingAmbulance ? setEditingAmbulance({ ...editingAmbulance, crew_capacity: Number(e.target.value) }) : setNewAmbulance({ ...newAmbulance, crew_capacity: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.ambulance.equipLevel')}</label>
                    <select value={editingAmbulance?.equipment_level || newAmbulance.equipment_level} onChange={(e) => editingAmbulance ? setEditingAmbulance({ ...editingAmbulance, equipment_level: e.target.value }) : setNewAmbulance({ ...newAmbulance, equipment_level: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                      <option value="basic">BLS (Basic)</option>
                      <option value="intermediate">ILS (Inter.)</option>
                      <option value="advanced">ALS (Advanced)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.ambulance.imeiTab')}</label>
                  <input type="text" value={editingAmbulance?.imei_tablette || newAmbulance.imei_tablette} onChange={(e) => editingAmbulance ? setEditingAmbulance({ ...editingAmbulance, imei_tablette: e.target.value }) : setNewAmbulance({ ...newAmbulance, imei_tablette: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('admin.equipment.ambulance.imeiGps')}</label>
                  <input type="text" value={editingAmbulance?.imei_gps || newAmbulance.imei_gps} onChange={(e) => editingAmbulance ? setEditingAmbulance({ ...editingAmbulance, imei_gps: e.target.value }) : setNewAmbulance({ ...newAmbulance, imei_gps: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button onClick={() => { setShowAmbulanceModal(false); setEditingAmbulance(null); }} className="px-4 py-2 text-gray-700 dark:text-gray-300">{t('common.cancel')}</button>
                  <button onClick={handleSaveAmbulance} className="bg-[#0096D6] text-white px-4 py-2 rounded-lg">{t('common.save')}</button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {/* Zone Geofence Editor */}
      {
        geofenceZone && (
          <GeofenceMapEditor
            initialGeofence={geofenceZone.polygon}
            initialFloorId={geofenceZone.floor_id}
            floors={floors}
            onSave={handleSaveZoneGeofence}
            onCancel={() => setGeofenceZone(null)}
          />
        )
      }
      {/* Geofence Map Editor */}
      {
        showGeofenceEditor && (
          <GeofenceMapEditor
            initialGeofence={editingSiren?.geofence || newSiren.geofence}
            initialFloorId={editingSiren?.floor_id ?? newSiren.floor_id}
            floors={floors}
            onSave={(geofence) => {
              if (editingSiren) setEditingSiren({ ...editingSiren, geofence });
              else setNewSiren({ ...newSiren, geofence });
              setShowGeofenceEditor(false);
            }}
            onCancel={() => setShowGeofenceEditor(false)}
          />
        )
      }
      {/* Room Geofence Editor */}
      {
        geofenceRoom && (
          <GeofenceMapEditor
            initialGeofence={geofenceRoom.polygon}
            initialFloorId={geofenceRoom.floor_id}
            floors={floors}
            onSave={handleSaveRoomGeofence}
            onCancel={() => setGeofenceRoom(null)}
          />
        )
      }
      {/* Modal Réinitialisation Mot de Passe */}
      {
        showResetModal && userToReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                      <Key className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {t('admin.users.resetPasswordTitle')}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('admin.users.resetPasswordFor', { name: userToReset.name })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowResetModal(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('admin.users.newPassword')}
                    </label>
                    <input
                      type="password"
                      autoFocus
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder={t('admin.users.passwordPlaceholder')}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                      <Shield className="h-3 w-3 mr-1" />
                      {t('admin.users.passwordHint')}
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3 mt-8">
                  <button
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleConfirmReset}
                    disabled={isResetting || resetPassword.length < 6}
                    className="flex-1 px-4 py-2 bg-[#0096D6] hover:bg-[#007BB5] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    {isResetting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{t('admin.users.updating')}</span>
                      </>
                    ) : (
                      <span>{t('common.confirm')}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {/* Floor Map Editor */}
      {
        mapEditingFloor && (
          <GeofenceMapEditor
            initialGeofence={mapEditMode === 'polygon' ? mapEditingFloor.corridor : mapEditingFloor.trajet}
            initialFloorId={mapEditingFloor.id}
            floors={floors}
            onSave={handleSaveFloorMap}
            onCancel={() => setMapEditingFloor(null)}
            mode={mapEditMode}
          />
        )
      }
    </div >
  );
}