
export const MEDICAL_ICON_LIBRARY: Record<string, string> = {
    // -----------------------------------------
    // 1. PERSONNEL ET PATIENTS
    // -----------------------------------------
    'medecin': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'personnel': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'patient': '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
    'chaise_roulante': '<circle cx="16" cy="16" r="4"/><path d="M12 12l-1.5-3.5A2 2 0 0 0 8.5 7H6"/><path d="M12 12h5l1.5 3.5"/><path d="M8 12l-2 4"/>',

    // -----------------------------------------
    // 2. MOBILIER ET TRANSPORT
    // -----------------------------------------
    'lit': '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
    'brancard': '<path d="M2 4v14"/><path d="M2 12h20"/><path d="M22 4v14"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>',
    'berceau': '<path d="M4 15V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11"/><rect x="2" y="15" width="20" height="6" rx="2"/><path d="M6 21v2"/><path d="M18 21v2"/>',
    'fauteuil': '<rect width="16" height="12" x="4" y="6" rx="2"/><path d="M2 14h20"/><path d="M4 18v2"/><path d="M20 18v2"/>',

    // -----------------------------------------
    // 3. MONITORING ET RÉANIMATION
    // -----------------------------------------
    'ecg': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'moniteur': '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M4 10h2l2-4 4 8 2-4h2"/>',
    'scope': '<circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/>',
    'defibrillateur': '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    'respirateur': '<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>',

    // -----------------------------------------
    // 4. ÉQUIPEMENTS SPÉCIFIQUES ET MACHINES
    // -----------------------------------------
    'pompe': '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>',
    'aspirateur_mobile': '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    'bistouri_electrique': '<path d="M14.5 3.5a2.12 2.12 0 0 1 3 3L8 16H5v-3l9.5-9.5z"/><path d="M15 5l4 4"/>',
    'couveuse': '<rect width="20" height="12" x="2" y="4" rx="2"/><path d="M6 16v4"/><path d="M18 16v4"/><path d="M2 10h20"/>',
    'phototherapie': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    'table_chauffante': '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M12 7v5"/>',
    'imprimante': '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',

    // -----------------------------------------
    // 5. ÉLÉMENTS GÉNÉRIQUES / SECOURS
    // -----------------------------------------
    'box': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    'croix': '<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/>',
    'alerte': '<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/>'
};

export const ICON_GROUPS = [
    {
        label: "Personnel et Patients",
        icons: [
            { id: 'medecin', label: 'Médecin' },
            { id: 'personnel', label: 'Personnel' },
            { id: 'patient', label: 'Patient' },
            { id: 'chaise_roulante', label: 'Chaise roulante' }
        ]
    },
    {
        label: "Mobilier et Transport",
        icons: [
            { id: 'lit', label: 'Lit d’hôpital' },
            { id: 'brancard', label: 'Brancard' },
            { id: 'berceau', label: 'Berceau' },
            { id: 'fauteuil', label: 'Fauteuil' }
        ]
    },
    {
        label: "Monitoring et Réanimation",
        icons: [
            { id: 'ecg', label: 'ECG (Pouls)' },
            { id: 'moniteur', label: 'Moniteur' },
            { id: 'scope', label: 'Scope' },
            { id: 'defibrillateur', label: 'Défibrillateur' },
            { id: 'respirateur', label: 'Respirateur' }
        ]
    },
    {
        label: "Équipements et Machines",
        icons: [
            { id: 'pompe', label: 'Pompe / SAP' },
            { id: 'aspirateur_mobile', label: 'Aspirateur' },
            { id: 'bistouri_electrique', label: 'Bistouri électrique' },
            { id: 'couveuse', label: 'Couveuse' },
            { id: 'phototherapie', label: 'Photothérapie' },
            { id: 'table_chauffante', label: 'Table chauffante' },
            { id: 'imprimante', label: 'Imprimante' }
        ]
    },
    {
        label: "Générique et Secours",
        icons: [
            { id: 'box', label: 'Machine / Box' },
            { id: 'croix', label: 'Croix médicale' },
            { id: 'alerte', label: 'Alerte / Panne' }
        ]
    }
];
