import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { 
  Upload, FileText, CheckCircle, Clock, AlertCircle, 
  MessageSquare, User, LogOut, ChevronRight, LayoutDashboard, 
  FileCheck, BookOpen, AlertTriangle, Edit2, Trash2, Save, RefreshCw,
  Maximize2, X, Bold, Italic, AlignLeft, AlignCenter, AlignRight, 
  AlignJustify, List, ListOrdered, Users
} from 'lucide-react';

declare global {
  const __firebase_config: string | undefined;
  const __initial_auth_token: string | undefined;
  const __app_id: string | undefined;
}

import firebaseConfigJson from '../firebase-applet-config.json';

// --- DATA & CONSTANTS ---
const ROLES = {
  HOD: 'Ketua Jabatan',
  COORDINATOR: 'Penyelaras',
  LECTURER: 'Pensyarah'
} as const;

type Role = typeof ROLES[keyof typeof ROLES];

interface UserConfig {
  id: string;
  name: string;
  role: Role;
}

interface FileItemType {
  id: string;
  name: string;
  size: string;
}

interface QuestionState {
  answer: string;
  files: FileItemType[];
  comment: string;
  hodComment: string;
  status: 'pending' | 'in_progress' | 'completed';
  updatedBy?: string | null;
  updatedAt?: string | null;
  lastAction?: string;
}

interface QuestionType {
  id: string;
  section: string;
  sectionTitle?: string;
  text: string;
}

interface MQA02Data {
  assignments: {
    [areaId: string]: string[];
  };
  [questionId: string]: any;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const PART_A_QUESTIONS: QuestionType[] = [
  { id: 'A1.1', section: 'partA', sectionTitle: 'General Information on the Higher Education Provider (HEP)', text: 'Name of the Higher Education Provider (HEP)' },
  { id: 'A1.2', section: 'partA', text: 'Date of Establishment / Registration' },
  { id: 'A1.3', section: 'partA', text: 'Reference No. of Approval for the Establishment' },
  { id: 'A1.4', section: 'partA', text: 'Name of the Chief Executive Officer' }
];

const PART_B_QUESTIONS: QuestionType[] = [
  { id: 'B1.1', section: 'partB', sectionTitle: 'Programme Description', text: 'Name of the Programme' },
  { id: 'B1.2', section: 'partB', text: 'Malaysian Qualifications Framework (MQF) Level' },
  { id: 'B1.3', section: 'partB', text: 'Graduating Credits' },
  { id: 'B1.4', section: 'partB', text: 'Duration of Study' }
];

const PART_C_QUESTIONS: QuestionType[] = [
  // Area 1
  { id: 'C1.1.1', section: 'Area 1', sectionTitle: 'Programme Development and Delivery', text: 'State the vision, mission and goals of the Higher Education Provider (HEP).' },
  { id: 'C1.1.2', section: 'Area 1', text: 'Provide evidence and explain how the department has considered market and societal demand for the programme. In what way is this proposed programme an enhancement of the others?' },
  { id: 'C1.1.3', section: 'Area 1', text: 'State the Programme Educational Objectives (PEOs), Programme Learning Outcomes (PLOs), teaching and learning strategies, and assessment methods. Explain how they are aligned with the institutional vision, mission, and goals.' },
  { id: 'C1.1.4', section: 'Area 1', text: 'Describe the consultation process with external stakeholders (industry advisors, professional bodies, academic experts, alumni, and community representatives) in designing and reviewing the curriculum.' },
  { id: 'C1.1.5', section: 'Area 1', text: 'Explain the governance structure, processes, and mechanisms established by the HEP for curriculum design, development, evaluation, approval, and monitoring.' },
  { id: 'C1.2.1', section: 'Area 1', text: 'Describe how the programme structure, course classifications, and credit weights satisfy the core requirements of the discipline of study (incorporating relevant Programme Standards where applicable).' },
  { id: 'C1.2.2', section: 'Area 1', text: 'Explain how the curriculum ensures structured and logical learning progression for students (from introductory/foundational to advanced levels).' },
  { id: 'C1.2.3', section: 'Area 1', text: 'Describe the delivery methods and student-centric Teaching and Learning (T&L) strategies used (e.g., blended learning, work-based learning, flipped classroom) to achieve the specified learning outcomes.' },
  { id: 'C1.2.4', section: 'Area 1', text: 'Explain how the department incorporates current technologies, digital tools, and innovative educational practices to enhance programme delivery and student engagement.' },
  { id: 'C1.2.5', section: 'Area 1', text: 'Describe the multi-disciplinary or holistic elements integrated into the curriculum (e.g., elective choices, industrial exposure, or community engagement) to foster well-rounded graduates.' },
  
  // Area 2
  { id: 'C2.1.1', section: 'Area 2', sectionTitle: 'Assessment of Student Learning', text: 'State and explain the HEP’s institutional assessment policy, framework, principles, and academic regulations governing this programme.' },
  { id: 'C2.1.2', section: 'Area 2', text: 'Explain how the alignment between Course Learning Outcomes (CLOs), Programme Learning Outcomes (PLOs), and diverse assessment methods (formative and summative) is systematically mapped and maintained.' },
  { id: 'C2.1.3', section: 'Area 2', text: 'Describe the precise internal mechanisms used to ensure the validity, reliability, fairness, consistency, and academic quality of assessment tools (e.g., pre-examination vetting processes, independent double marking, or external moderation).' },
  { id: 'C2.1.4', section: 'Area 2', text: 'State the grading system, passing marks, graduation requirements, policies on GPA/CGPA computation, and regulations regarding satisfactory academic standing.' },
  { id: 'C2.2.1', section: 'Area 2', text: 'Describe how the department monitors, reviews, and documents individual student assessment performance over time.' },
  { id: 'C2.2.2', section: 'Area 2', text: 'Explain how student assessment results and data analysis are actively utilized as part of the Continuous Quality Improvement (CQI) cycle at both course and programme levels.' },
  { id: 'C2.2.3', section: 'Area 2', text: 'State the structural policies and formal procedures for handling student academic appeals, grading grievances, and managing cases of academic dishonesty (such as plagiarism or cheating).' },
  
  // Area 3
  { id: 'C3.1.1', section: 'Area 3', sectionTitle: 'Student Selection and Support Services', text: 'State the clear entry requirements (minimum criteria, course prerequisites, and English language proficiency requirements) for admission into the programme.' },
  { id: 'C3.1.2', section: 'Area 3', text: 'Describe the operational criteria, verification mechanisms, and selection processes used to admit students into the programme fairly.' },
  { id: 'C3.1.3', section: 'Area 3', text: 'Explain the specific institutional policies, rules, and procedures regarding credit transfer, course exemption, and the Accreditation of Prior Experiential Learning (APEL).' },
  { id: 'C3.2.1', section: 'Area 3', text: 'Detail the academic counseling, career guidance, pastoral care, and non-academic support services available to students enrolled in this programme.' },
  { id: 'C3.2.2', section: 'Area 3', text: 'Describe the automated or manual mechanisms used for monitoring student academic progress, early identification of at-risk students, and the specific remedial or intervention plans provided.' },
  { id: 'C3.2.3', section: 'Area 3', text: 'Explain how student feedback regarding support services is regularly collected, analysed, and acted upon to improve student well-being.' },
  
  // Area 4
  { id: 'C4.1.1', section: 'Area 4', sectionTitle: 'Academic Staff', text: 'State the department’s recruitment policy, mandatory criteria, and qualification levels required for academic staff assigned to teach in this programme.' },
  { id: 'C4.1.2', section: 'Area 4', text: 'Provide the current staff-to-student ratio calculation for the programme and justify its adequacy in ensuring effective delivery and interaction.' },
  { id: 'C4.1.3', section: 'Area 4', text: 'Describe the balance between full-time, part-time, and contract academic staff to ensure programme stability, continuity, and specialized industry input.' },
  { id: 'C4.2.1', section: 'Area 4', text: 'Describe the HEP’s policy, budget provisions, and structural support for the continuous professional development (CPD), pedagogical training, and industrial upskilling of academic staff.' },
  { id: 'C4.2.2', section: 'Area 4', text: 'Explain the annual performance appraisal system for academic staff, incorporating key performance indicators (KPIs) in teaching, research, and service.' },
  { id: 'C4.2.3', section: 'Area 4', text: 'Detail how student evaluation data (Student Evaluation of Teaching) is collected, shared with staff, and integrated into staff development or performance reviews.' },

  // Area 5
  { id: 'C5.1.1', section: 'Area 5', sectionTitle: 'Educational Resources', text: 'Describe the physical learning infrastructure (lecture halls, tutorial rooms, specialized laboratories, computer labs, workshops, or studios) available to support the current and projected student intake.' },
  { id: 'C5.1.2', section: 'Area 5', text: 'Detail the library and learning resource center assets, including the specific collection size, physical textbook titles, and digital databases/e-journals subscribed for this discipline.' },
  { id: 'C5.1.3', section: 'Area 5', text: 'Describe the Information and Communications Technology (ICT) infrastructure, Learning Management Systems (LMS), field-specific software licenses, and technical support services available to students and staff.' },
  { id: 'C5.1.4', section: 'Area 5', text: 'Explain the operational and capital budget allocation models to demonstrate the financial sustainability, upkeep, and future replacement plans for these educational resources.' },
  
  // Area 6
  { id: 'C6.1.1', section: 'Area 6', sectionTitle: 'Programme Management', text: 'Describe the governance structure, administrative organizational chart, and leadership positions managing this specific programme.' },
  { id: 'C6.1.2', section: 'Area 6', text: 'State the criteria, roles, responsibilities, and terms of reference for the Programme Leader / Coordinator.' },
  { id: 'C6.1.3', section: 'Area 6', text: 'Describe the mechanisms used to maintain effective communication, records management, and security of student data within the department.' },
  { id: 'C6.2.1', section: 'Area 6', text: 'Explain how academic staff and students are actively involved in the committee structures and decision-making processes regarding programme management and operations.' },
  { id: 'C6.2.2', section: 'Area 6', text: 'Describe the role and operational impact of external evaluators, external examiners, and professional/industry advisory panels in validating the execution of the programme.' },
  
  // Area 7
  { id: 'C7.1.1', section: 'Area 7', sectionTitle: 'Continuous Quality Improvement (CQI)', text: 'Describe the institutionalized mechanisms, policies, and timelines for the regular monitoring, evaluation, and holistic review of the curriculum.' },
  { id: 'C7.1.2', section: 'Area 7', text: 'Explain how feedback from various stakeholders (students, alumni, external examiners, employers, industry advisory panels) is systematically gathered, processed, and closed-loop tracked.' },
  { id: 'C7.1.3', section: 'Area 7', text: 'Provide descriptive evidence of recent major curriculum revisions, updates, or future planned adjustments implemented as a direct result of the CQI data analysis to ensure the programme remains relevant to contemporary changes.' },
];

const ALL_QUESTIONS = [...PART_A_QUESTIONS, ...PART_B_QUESTIONS, ...PART_C_QUESTIONS];

// Initialize dataset
const INITIAL_DATA: MQA02Data = ALL_QUESTIONS.reduce<any>((acc, q) => {
  acc[q.id] = { answer: '', files: [], comment: '', hodComment: '', status: 'pending', updatedBy: null, updatedAt: null };
  return acc;
}, { assignments: {} }) as MQA02Data;

// Generate lecturer accounts
const LECTURERS: UserConfig[] = [
  { id: 'lecturer_1', name: 'Dr. Nurul Farhaini binti Razali', role: ROLES.LECTURER },
  { id: 'lecturer_2', name: 'Dr. Ivy Deirde Deirdre Mangkau', role: ROLES.LECTURER },
  { id: 'lecturer_3', name: 'Dr. Nur Ilyana Amiiraa binti Nordin', role: ROLES.LECTURER },
  { id: 'lecturer_4', name: 'Dr. Nur Erma Suryani binti Mohd Jamel', role: ROLES.LECTURER },
  { id: 'lecturer_5', name: 'Dr. Athirah binti Mohd Tan', role: ROLES.LECTURER },
  { id: 'lecturer_6', name: 'Dr. Aini Khalida binti Muslim', role: ROLES.LECTURER },
  { id: 'lecturer_7', name: 'Encik Wan Muhammad Idham bin Wan Mahdi', role: ROLES.LECTURER },
  { id: 'lecturer_8', name: 'Encik Mohd Syafiq bin Md. Taib', role: ROLES.LECTURER },
  { id: 'lecturer_9', name: 'Cik Nurul Hasyimah binti Mohamed', role: ROLES.LECTURER },
  { id: 'lecturer_10', name: 'Cik Amirah Syahirah binti Mawardi', role: ROLES.LECTURER }
];

const USERS: UserConfig[] = [
  { id: 'hod_1', name: 'Dr. Mukhiffun bin Mukapit (Ketua Jabatan)', role: ROLES.HOD },
  { id: 'coord_1', name: 'Dr. Mohd Guzairy bin Abd Ghani (Penyelaras)', role: ROLES.COORDINATOR },
  ...LECTURERS
];

// --- SAFE FIREBASE CONFIGURATION SETUP ---
let firebaseApp: any = null;
let firebaseAuth: any = null;
let firebaseDb: any = null;
let isFirebaseActive = false;

let parsedFirebaseConfig: any = firebaseConfigJson;

// Fallback to __firebase_config if imported json is empty or non-existent
if (!parsedFirebaseConfig || !parsedFirebaseConfig.apiKey) {
  const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
  if (firebaseConfigStr) {
    try {
      parsedFirebaseConfig = JSON.parse(firebaseConfigStr);
    } catch (err) {
      console.error("Gagal mengurai __firebase_config:", err);
    }
  }
}

if (parsedFirebaseConfig && parsedFirebaseConfig.apiKey) {
  try {
    firebaseApp = initializeApp(parsedFirebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
    if (parsedFirebaseConfig.firestoreDatabaseId) {
      firebaseDb = getFirestore(firebaseApp, parsedFirebaseConfig.firestoreDatabaseId);
    } else {
      firebaseDb = getFirestore(firebaseApp);
    }
    isFirebaseActive = true;
  } catch (err) {
    console.error("Gagal mulakan Firebase SDK:", err);
  }
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-mqa02-app';

// --- MAIN APP COMPONENT ---
export default function App() {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<UserConfig | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [data, setData] = useState<MQA02Data>(INITIAL_DATA);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'info' | 'success' | 'error' }>({ show: false, message: '', type: 'info' });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Initial persistence load
  useEffect(() => {
    const saved = localStorage.getItem('mqa02_data_local');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged: MQA02Data = { ...INITIAL_DATA, ...parsed };
        setData(merged);
      } catch (e) {
        console.error("Gagal membaca local storage backup:", e);
      }
    }
  }, []);

  // Firebase Auth Setup
  useEffect(() => {
    if (!isFirebaseActive || !firebaseAuth) {
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(firebaseAuth, __initial_auth_token);
        } else {
          await signInAnonymously(firebaseAuth);
        }
      } catch (error) {
        console.error("Firebase custom auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(firebaseAuth, (u) => {
      setAuthUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Firebase Real-time Firestore Synchronizer (Granular Documents Listener)
  useEffect(() => {
    if (!isFirebaseActive || !firebaseDb || !authUser || !appUser) {
      return;
    }

    const questionsCollRef = collection(firebaseDb, 'artifacts', appId, 'public', 'data', 'mqa02_questions');
    const assignmentsDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'mqa02_assignments', 'main');

    // Subscribe to all questions
    const unsubscribeQuestions = onSnapshot(questionsCollRef, (querySnapshot) => {
      setData(prevData => {
        const updatedData = { ...prevData };
        querySnapshot.forEach((docSnap) => {
          const qId = docSnap.id;
          const docData = docSnap.data();
          if (docData && docData.data) {
            updatedData[qId] = {
              ...INITIAL_DATA[qId],
              ...docData.data
            };
          }
        });
        localStorage.setItem('mqa02_data_local', JSON.stringify(updatedData));
        return updatedData;
      });
    }, (error) => {
      console.error("Firebase questions sync error:", error);
      showToast('Gagal menyegerak data kriteria dari pelayan.', 'error');
    });

    // Subscribe to assignments
    const unsubscribeAssignments = onSnapshot(assignmentsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const assignmentsData = docSnap.data().assignments;
        setData(prevData => {
          const updatedData = {
            ...prevData,
            assignments: assignmentsData || {}
          };
          localStorage.setItem('mqa02_data_local', JSON.stringify(updatedData));
          return updatedData;
        });
      }
    }, (error) => {
      console.error("Firebase assignments sync error:", error);
      showToast('Gagal menyegerak senarai tugas dari pelayan.', 'error');
    });

    return () => {
      unsubscribeQuestions();
      unsubscribeAssignments();
    };
  }, [authUser, appUser]);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ show: true, message, type });
    const timer = setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
    return () => clearTimeout(timer);
  };

  const saveDataToCloud = async (newData: MQA02Data, targetQuestionId?: string, targetAssignments?: any) => {
    // Save to local storage as fallback/immediate storage
    localStorage.setItem('mqa02_data_local', JSON.stringify(newData));

    if (!isFirebaseActive || !firebaseDb || !authUser || !appUser) {
      setLastSaved(new Date().toLocaleTimeString('ms-MY') + ' (Tempatan)');
      return;
    }

    setIsSaving(true);
    try {
      if (targetQuestionId) {
        // Save only this single question document to prevent concurrency conflict!
        const questionDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'mqa02_questions', targetQuestionId);
        await setDoc(questionDocRef, { data: newData[targetQuestionId] }, { merge: true });
      }

      if (targetAssignments) {
        // Save the assignments document
        const assignmentsDocRef = doc(firebaseDb, 'artifacts', appId, 'public', 'data', 'mqa02_assignments', 'main');
        await setDoc(assignmentsDocRef, { assignments: targetAssignments }, { merge: true });
      }

      setLastSaved(new Date().toLocaleTimeString('ms-MY'));
    } catch (error) {
      console.error("Firebase save error:", error);
      showToast('Gagal menyimpan draf ke awan kualiti MQA.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const login = (selectedUser: UserConfig) => {
    setAppUser(selectedUser);
    setActiveTab(selectedUser.role === ROLES.HOD ? 'dashboard' : 'Area 1');
    showToast(`Log masuk berjaya sebagai ${selectedUser.name}`, 'success');
  };

  const handleLogout = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setAppUser(null);
    setAuthUser(null);
    setActiveTab('dashboard'); 
    setToast({ show: false, message: '', type: 'info' });
  };

  const trackAndSave = (questionId: string, newFields: Partial<QuestionState>) => {
    if (!appUser) return;
    const timestamp = new Date().toLocaleString('ms-MY');
    const currentItemData = data[questionId] || { answer: '', files: [], comment: '', hodComment: '', status: 'pending' };
    const newData: MQA02Data = {
      ...data,
      [questionId]: {
        ...currentItemData,
        ...newFields,
        updatedBy: appUser.name,
        updatedAt: timestamp
      } as QuestionState
    };
    setData(newData);
    saveDataToCloud(newData, questionId);
  };

  const handleUpdateAnswer = (id: string, newAnswer: string) => {
    const qState = data[id] || { status: 'pending' };
    trackAndSave(id, { 
      answer: newAnswer, 
      lastAction: 'Mengemaskini jawapan',
      status: qState.status === 'pending' && newAnswer.trim() ? 'in_progress' : qState.status 
    });
  };

  const handleFileUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (!selectedFiles.length) return;

    const validFiles: FileItemType[] = [];
    selectedFiles.forEach((file: File) => {
      if (file.type !== 'application/pdf') {
        showToast(`Fail ${file.name} bukan PDF. Diabaikan.`, 'error');
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast(`Saiz fail ${file.name} melebihi ${MAX_FILE_SIZE_MB}MB! Diabaikan.`, 'error');
      } else {
        validFiles.push({
          id: Math.random().toString(36).substring(2, 11),
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + ' MB'
        });
      }
    });

    if (validFiles.length > 0) {
      const qState = data[id] || { files: [], status: 'pending' };
      trackAndSave(id, {
        files: [...(qState.files || []), ...validFiles],
        lastAction: `Memuat naik ${validFiles.length} lampiran PDF`,
        status: qState.status === 'pending' ? 'in_progress' : qState.status
      });
      showToast(`${validFiles.length} fail PDF berjaya ditambah.`, 'success');
    }
    e.target.value = ''; 
  };

  const handleRenameFile = (questionId: string, fileId: string, newName: string) => {
    if (!newName.trim()) return;
    const qData = data[questionId];
    if (!qData) return;
    const newFiles = qData.files.map(f => 
      f.id === fileId ? { ...f, name: newName.endsWith('.pdf') ? newName : newName + '.pdf' } : f
    );
    trackAndSave(questionId, { files: newFiles, lastAction: 'Menukar nama lampiran' });
  };

  const handleDeleteFile = (questionId: string, fileId: string) => {
    const qData = data[questionId];
    if (!qData) return;
    const newFiles = qData.files.filter(f => f.id !== fileId);
    trackAndSave(questionId, { files: newFiles, lastAction: 'Memadam lampiran' });
    showToast('Fail berjaya dipadam.', 'info');
  };

  const handleUpdateComment = (id: string, comment: string, type: 'coordinator' | 'hod' = 'coordinator') => {
    const field = type === 'hod' ? 'hodComment' : 'comment';
    trackAndSave(id, { [field]: comment, lastAction: `Meninggalkan komen (${type === 'hod' ? 'Ketua Jabatan' : 'Penyelaras'})` });
  };

  const handleUpdateStatus = (id: string, status: any) => {
    trackAndSave(id, { status, lastAction: `Menukar status kepada ${status}` });
    showToast(`Status dikemaskini kepada: ${status.replace('_', ' ')}`, 'success');
  };

  const handleUpdateAssignment = (area: string, lecturerId: string) => {
    const assignments = data.assignments || {};
    const currentAssignments = assignments[area] || [];
    const newAssignments = currentAssignments.includes(lecturerId)
        ? currentAssignments.filter(id => id !== lecturerId)
        : [...currentAssignments, lecturerId];

    const updatedAssignments = {
      ...assignments,
      [area]: newAssignments
    };

    const newData: MQA02Data = {
        ...data,
        assignments: updatedAssignments
    };
    setData(newData);
    saveDataToCloud(newData, undefined, updatedAssignments);
    showToast('Tugasan pensyarah berjaya dikemaskini.', 'success');
  };

  if (!appUser) {
    return <LoginScreen users={USERS} onLogin={login} toast={toast} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <style>{`
        .rich-editor:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          display: block;
        }
        .rich-editor ul {
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .rich-editor ol {
          list-style-type: decimal !important;
          padding-left: 1.5rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
      `}</style>

      {/* Toast Banner */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 ${
          toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 
          toast.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white shadow-xs border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-indigo-600 mr-3 animate-pulse" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">MQA02 BTEC Mode Industri</h1>
                <p className="text-xs text-slate-500 font-medium">Sistem Pengurusan & Pemantauan Dokumen MQA</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-xs mr-4">
                {isSaving ? (
                  <span className="flex items-center gap-1 text-amber-600 font-semibold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    <RefreshCw size={14} className="animate-spin" /> Menyimpan draf...
                  </span>
                ) : lastSaved ? (
                  <span className="flex items-center gap-1 text-slate-600 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle size={14} className="text-emerald-500" /> Auto-saved: {lastSaved}
                  </span>
                ) : (
                  <span className="text-slate-400">Penyimpanan automatik aktif</span>
                )}
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{appUser.name}</p>
                <p className="text-xs text-indigo-600 font-semibold">{appUser.role}</p>
              </div>
              <button 
                type="button"
                onClick={() => handleLogout()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 rounded-lg transition-colors cursor-pointer font-bold text-xs border border-slate-200"
              >
                <LogOut size={14} />
                <span>Log Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Primary Layout Grid */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-72 flex-shrink-0">
          <nav className="space-y-1 sticky top-24 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <NavItem 
              icon={<LayoutDashboard size={16} />} 
              label="Papan Pemuka" 
              isActive={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            {appUser.role === ROLES.HOD && (
              <NavItem 
                icon={<Users size={16} />} 
                label="Senarai Tugasan" 
                isActive={activeTab === 'assignments'} 
                onClick={() => setActiveTab('assignments')} 
              />
            )}
            
            <div className="pt-4 pb-1">
              <p className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Borang Asas</p>
            </div>
            <NavItem icon={<FileText size={16} />} label="Part A: Maklumat Am" isActive={activeTab === 'partA'} onClick={() => setActiveTab('partA')} />
            <NavItem icon={<FileText size={16} />} label="Part B: Maklumat Program" isActive={activeTab === 'partB'} onClick={() => setActiveTab('partB')} />
            
            <div className="pt-4 pb-1">
              <p className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Reka Bentuk Kurikulum</p>
            </div>
            <div className="space-y-1 border-l border-slate-200 ml-3 pl-2.5">
              <NavItem icon={<FileCheck size={14} />} label="Area 1: Prog. Development" isActive={activeTab === 'Area 1'} onClick={() => setActiveTab('Area 1')} />
              <NavItem icon={<FileCheck size={14} />} label="Area 2: Assessment" isActive={activeTab === 'Area 2'} onClick={() => setActiveTab('Area 2')} />
              <NavItem icon={<FileCheck size={14} />} label="Area 3: Student Support" isActive={activeTab === 'Area 3'} onClick={() => setActiveTab('Area 3')} />
              <NavItem icon={<FileCheck size={14} />} label="Area 4: Academic Staff" isActive={activeTab === 'Area 4'} onClick={() => setActiveTab('Area 4')} />
              <NavItem icon={<FileCheck size={14} />} label="Area 5: Educ. Resources" isActive={activeTab === 'Area 5'} onClick={() => setActiveTab('Area 5')} />
              <NavItem icon={<FileCheck size={14} />} label="Area 6: Prog. Management" isActive={activeTab === 'Area 6'} onClick={() => setActiveTab('Area 6')} />
              <NavItem icon={<FileCheck size={14} />} label="Area 7: CQI" isActive={activeTab === 'Area 7'} onClick={() => setActiveTab('Area 7')} />
            </div>
          </nav>
        </div>

        {/* Content Container */}
        <div className="flex-1 min-w-0">
          {activeTab === 'dashboard' && <Dashboard user={appUser} data={data} />}
          {activeTab === 'assignments' && appUser.role === ROLES.HOD && <AssignmentList data={data} lecturers={LECTURERS} />}
          {(activeTab === 'partA' || activeTab === 'partB' || activeTab.startsWith('Area')) && (
            <FormSection 
              user={appUser} 
              data={data} 
              activeArea={activeTab}
              onUpdateAnswer={handleUpdateAnswer}
              onFileUpload={handleFileUpload}
              onRenameFile={handleRenameFile}
              onDeleteFile={handleDeleteFile}
              onUpdateComment={handleUpdateComment}
              onUpdateStatus={handleUpdateStatus}
              onUpdateAssignment={handleUpdateAssignment}
              lecturers={LECTURERS}
            />
          )}
        </div>

      </div>
    </div>
  );
}

// --- CORE EDITOR MODULE ---
interface RichEditorProps {
  value: string;
  onChange?: (val: string) => void;
  disabled: boolean;
  placeholder: string;
  minHeight?: string;
}

function RichTextEditor({ value, onChange, disabled, placeholder, minHeight = '120px' }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const execCmd = (cmd: string, arg: string | undefined = undefined) => {
    document.execCommand(cmd, false, arg);
    editorRef.current?.focus();
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleBlur = () => {
    if (onChange && editorRef.current && editorRef.current.innerHTML !== value) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const ToolbarBtn = ({ onClick, icon, title }: { onClick: () => void; icon: React.ReactNode; title: string }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
    >
      {icon}
    </button>
  );

  return (
    <div className={`border ${disabled ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500'} rounded-lg overflow-hidden flex flex-col transition-all w-full`}>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 p-1 border-b border-slate-200 bg-slate-50">
          <ToolbarBtn onClick={() => execCmd('bold')} icon={<Bold size={14} />} title="Bold" />
          <ToolbarBtn onClick={() => execCmd('italic')} icon={<Italic size={14} />} title="Italic" />
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <ToolbarBtn onClick={() => execCmd('justifyLeft')} icon={<AlignLeft size={14} />} title="Align Kiri" />
          <ToolbarBtn onClick={() => execCmd('justifyCenter')} icon={<AlignCenter size={14} />} title="Tengah" />
          <ToolbarBtn onClick={() => execCmd('justifyRight')} icon={<AlignRight size={14} />} title="Align Kanan" />
          <ToolbarBtn onClick={() => execCmd('justifyFull')} icon={<AlignJustify size={14} />} title="Justify" />
          <div className="w-px h-4 bg-slate-300 mx-1"></div>
          <ToolbarBtn onClick={() => execCmd('insertUnorderedList')} icon={<List size={14} />} title="List Bullet" />
          <ToolbarBtn onClick={() => execCmd('insertOrderedList')} icon={<ListOrdered size={14} />} title="List Nombor" />
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onBlur={handleBlur}
        className={`rich-editor p-3.5 outline-none overflow-y-auto w-full text-sm leading-relaxed ${disabled ? 'text-slate-500 cursor-not-allowed' : 'text-slate-800'}`}
        style={{ minHeight }}
        data-placeholder={placeholder}
      />
    </div>
  );
}

// --- PORTAL LOGIN SCREEN ---
interface LoginProps {
  users: UserConfig[];
  onLogin: (u: UserConfig) => void;
  toast: { show: boolean; message: string; type: string };
}

function LoginScreen({ users, onLogin, toast }: LoginProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    const user = users.find(u => u.id === selectedUserId);
    if (user) onLogin(user);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="text-indigo-600 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Sistem Portal MQA02</h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">BTEC Mode Industri • UTM / HEP</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Pilih Profil Pengguna</label>
            <select 
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none transition-all cursor-pointer font-medium text-slate-700"
              required
            >
              <option value="" disabled>-- Pilih Akaun --</option>
              <optgroup label="Pengurusan & Pentadbiran">
                {users.filter(u => u.role !== ROLES.LECTURER).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </optgroup>
              <optgroup label="Senarai Ahli Akademik / Pensyarah">
                {users.filter(u => u.role === ROLES.LECTURER).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2 cursor-pointer shadow-sm text-sm"
          >
            <span>Log Masuk Modul</span>
            <ChevronRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

// --- NAVIGATION ELEMENT ---
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
        isActive 
          ? 'bg-indigo-50 text-indigo-700 font-bold border-l-2 border-indigo-600' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// --- PAPAN PEMUKA (DASHBOARD) ---
function Dashboard({ user, data }: { user: UserConfig; data: MQA02Data }) {
  const totalQuestions = ALL_QUESTIONS.length;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;
  let filledAnswersCount = 0;

  const sectionStats: { [sectionKey: string]: { total: number; completed: number; inProgress: number; pending: number; filled: number; title: string } } = {
    partA: { total: 0, completed: 0, inProgress: 0, pending: 0, filled: 0, title: 'Part A: Maklumat Am' },
    partB: { total: 0, completed: 0, inProgress: 0, pending: 0, filled: 0, title: 'Part B: Maklumat Program' }
  };
  
  for (let i = 1; i <= 7; i++) {
    sectionStats[`Area ${i}`] = { total: 0, completed: 0, inProgress: 0, pending: 0, filled: 0, title: `Area ${i}: Jaminan Kualiti Reka Bentuk` };
  }

  ALL_QUESTIONS.forEach(q => {
    const itemData = data[q.id] || { answer: '', status: 'pending' };
    const status = itemData.status;
    const sec = q.section;
    const hasText = itemData.answer && itemData.answer.replace(/<[^>]*>/g, '').trim().length > 0;
    
    if (!sectionStats[sec]) return;

    sectionStats[sec].total++;
    if (hasText) {
      filledAnswersCount++;
      sectionStats[sec].filled++;
    }

    if (status === 'completed') { 
      completed++; 
      sectionStats[sec].completed++; 
    } else if (status === 'in_progress') { 
      inProgress++; 
      sectionStats[sec].inProgress++; 
    } else { 
      pending++; 
      sectionStats[sec].pending++; 
    }
  });

  const completionPercent = Math.round((completed / totalQuestions) * 100) || 0;
  const draftPercent = Math.round((filledAnswersCount / totalQuestions) * 100) || 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Selamat Pulang, Dr./Tuan/Puan</h2>
        <p className="text-xs text-slate-500 mt-1">Status kualiti dan kemajuan pelaksanaan pengisian borang setakat ini:</p>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-indigo-700/80 uppercase tracking-widest font-mono">Draf Diisi</p>
              <p className="text-2xl font-black text-indigo-900 mt-1">{filledAnswersCount} <span className="text-xs font-normal text-slate-500">/ {totalQuestions}</span></p>
            </div>
            <FileText className="text-indigo-500 w-8 h-8" />
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-emerald-700/80 uppercase tracking-widest font-mono">Disahkan Selesai</p>
              <p className="text-2xl font-black text-emerald-900 mt-1">{completed} <span className="text-xs font-normal text-slate-500">/ {totalQuestions}</span></p>
            </div>
            <CheckCircle className="text-emerald-500 w-8 h-8 animate-pulse" />
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest font-mono">Kemajuan Keseluruhan</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{completionPercent}%</p>
            </div>
            <div className="relative flex items-center justify-center">
              <RefreshCw className="text-slate-400 w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-6 font-mono uppercase tracking-wider">Metrik Terperinci Mengikut Bahagian</h3>
        <div className="space-y-6">
          {Object.keys(sectionStats).map(sec => {
            const stat = sectionStats[sec];
            if (stat.total === 0) return null;
            const pctCompleted = Math.round((stat.completed / stat.total) * 100) || 0;
            const pctFilled = Math.round((stat.filled / stat.total) * 100) || 0;

            return (
              <div key={sec} className="relative">
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="font-bold text-slate-800">{stat.title}</span>
                  <span className="text-slate-500 font-mono">Draf Data: {stat.filled}/{stat.total}</span>
                </div>
                {/* Visual Draft Bar */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1.5">
                  <div className="h-1.5 rounded-full bg-indigo-400 transition-all duration-500" style={{ width: `${pctFilled}%` }}></div>
                </div>
                {/* Visual Verification Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all duration-500 ${pctCompleted === 100 ? 'bg-emerald-600' : 'bg-emerald-400'}`} style={{ width: `${pctCompleted}%` }}></div>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>Disahkan Selesai (Completed): {pctCompleted}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- SENARAI TUGASAN (ASSIGNMENTS) ---
function AssignmentList({ data, lecturers }: { data: MQA02Data; lecturers: UserConfig[] }) {
    const sections = [
        { id: 'partA', title: 'Part A: Maklumat Am' },
        { id: 'partB', title: 'Part B: Maklumat Program' },
        ...Array.from({ length: 7 }, (_, i) => ({ id: `Area ${i + 1}`, title: `Part C: Area ${i + 1}` }))
    ];

    const assignments = data.assignments || {};

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <Users className="text-indigo-600 h-6 w-6" />
                <h3 className="text-base font-bold text-slate-800">Senarai Tugas Guru / Ahli Akademik</h3>
            </div>
            
            <div className="space-y-6">
                {sections.map(section => {
                    const assignedLecIds = assignments[section.id] || [];
                    const assignedLecs = assignedLecIds.map(id => lecturers.find(l => l.id === id)).filter(Boolean);

                    return (
                        <div key={section.id} className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                <h4 className="font-bold text-xs text-slate-700 font-mono tracking-wide uppercase">{section.title}</h4>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-500">
                                    {assignedLecs.length} Pensyarah Ditugaskan
                                </span>
                            </div>
                            <div className="p-4">
                                {assignedLecs.length > 0 ? (
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {assignedLecs.map(lec => (
                                            <li key={lec?.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                                                <User size={14} className="text-indigo-400" />
                                                <span>{lec?.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-amber-600 italic flex items-center gap-1.5 ml-1">
                                        <AlertCircle size={14} /> Tiada pensyarah ditugaskan untuk bahagian ini.
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// --- FORM SECTION VIEWS ---
interface FormSectionProps {
  user: UserConfig;
  data: MQA02Data;
  activeArea: string;
  onUpdateAnswer: (id: string, ans: string) => void;
  onFileUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRenameFile: (qId: string, fId: string, newName: string) => void;
  onDeleteFile: (qId: string, fId: string) => void;
  onUpdateComment: (id: string, text: string, type: 'coordinator' | 'hod') => void;
  onUpdateStatus: (id: string, status: any) => void;
  onUpdateAssignment: (area: string, lecId: string) => void;
  lecturers: UserConfig[];
}

function FormSection({ 
  user, 
  data, 
  activeArea, 
  onUpdateAnswer, 
  onFileUpload, 
  onRenameFile, 
  onDeleteFile, 
  onUpdateComment, 
  onUpdateStatus, 
  onUpdateAssignment, 
  lecturers 
}: FormSectionProps) {
  const isHOD = user.role === ROLES.HOD;
  const isCoord = user.role === ROLES.COORDINATOR;
  const isLecturer = user.role === ROLES.LECTURER;
  const [expandedQId, setExpandedQId] = useState<string | null>(null);

  const filteredQuestions = ALL_QUESTIONS.filter(q => q.section === activeArea);
  const expandedQuestion = ALL_QUESTIONS.find(q => q.id === expandedQId);
  const areaTitle = filteredQuestions.length > 0 ? filteredQuestions[0].sectionTitle : '';
  
  const currentAssignments = data.assignments?.[activeArea] || [];
  const isAssigned = isLecturer ? currentAssignments.includes(user.id) : false;
  const canEdit = isCoord || isAssigned;

  const getTitle = () => {
    if (activeArea === 'partA') return 'Part A: Maklumat Am HEP';
    if (activeArea === 'partB') return 'Part B: Maklumat Program';
    return `Part C: ${activeArea}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">{getTitle()}</h2>
          <p className="text-slate-500 text-xs mt-1 font-medium">{areaTitle || 'Isi maklumat rujukan, maklum balas dan lampiran dokumen sokongan bagi borang ini.'}</p>
        </div>
        
        {/* Coordinator Assignments Module */}
        {(isCoord || isHOD) && (
          <div className={`${isCoord ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'} border rounded-xl p-4 mt-2`}>
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className={isCoord ? "text-indigo-700" : "text-slate-700"} />
              <h3 className={`font-bold text-xs ${isCoord ? "text-indigo-900" : "text-slate-800"} uppercase tracking-wide`}>
                {isCoord ? "Agihan Tugas Penyediaan Bahagian Ini" : "Senarai Ahli Akademik Terlibat"}
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isCoord ? (
                lecturers.map(lec => {
                  const isSelected = currentAssignments.includes(lec.id);
                  return (
                    <button
                      key={lec.id}
                      onClick={() => onUpdateAssignment(activeArea, lec.id)}
                      className={`px-3 py-1 bg-white border text-xs font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                          : 'text-slate-600 border-slate-300 hover:border-indigo-400'
                      }`}
                    >
                      {isSelected && <CheckCircle size={10} />}
                      <span>{lec.name}</span>
                    </button>
                  );
                })
              ) : (
                currentAssignments.length > 0 ? (
                  currentAssignments.map(id => {
                    const lec = lecturers.find(l => l.id === id);
                    if (!lec) return null;
                    return (
                      <span key={id} className="px-3 py-1 text-xs font-semibold rounded-full bg-white border border-slate-200 text-slate-700 shadow-xs flex items-center gap-1.5">
                        <User size={12} className="text-indigo-500"/>
                        <span>{lec.name}</span>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-500 italic flex items-center gap-1.5">
                    <AlertCircle size={14} /> Tiada pensyarah ditugaskan untuk bahagian ini.
                  </span>
                )
              )}
            </div>
          </div>
        )}

        {isLecturer && !isAssigned && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-lg text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
            <span>MQA Alert: Anda belum ditugaskan untuk mengedit bahagian ini. Mod baca sahaja diaktifkan.</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4 w-[25%]">Keperluan Kriteria MQA02</th>
                <th className="p-4 w-[45%]">Rujukan Jawapan & Bukti Fail PDF</th>
                <th className="p-4 w-[25%]">Komen & Status Jaminan Kualiti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuestions.map((q) => {
                const itemData = data[q.id] || { answer: '', files: [], comment: '', hodComment: '', status: 'pending' };

                return (
                  <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 align-top font-bold text-center text-slate-950 bg-slate-50/20">{q.id}</td>
                    <td className="p-4 align-top text-slate-800 leading-relaxed font-medium">
                      {q.text}
                    </td>
                    
                    {/* Writing Draft & Files Cell */}
                    <td className="p-4 align-top">
                      <div className="space-y-3">
                        <div className="relative group/textarea">
                          <RichTextEditor 
                            value={itemData.answer}
                            onChange={(val) => onUpdateAnswer(q.id, val)}
                            disabled={!canEdit || isHOD}
                            placeholder={(!canEdit || isHOD) ? "MQA Locked: Hanya mod paparan sahaja dibenarkan." : "Masukkan rujukan dokumen atau keterangan draf di sini..."}
                            minHeight="110px"
                          />
                          <button 
                            onClick={() => setExpandedQId(q.id)}
                            className="absolute top-2.5 right-2.5 p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all shadow-sm opacity-0 group-hover/textarea:opacity-100 z-10 cursor-pointer"
                            title="Pratonton / Edit Skrin Penuh"
                          >
                            <Maximize2 size={12} />
                          </button>
                        </div>
                        
                        {/* Attachments Section */}
                        <div className="space-y-1.5">
                          {(itemData.files || []).map((file) => (
                            <FileItem 
                              key={file.id} 
                              file={file} 
                              canEdit={canEdit && !isHOD} 
                              onRename={(newName) => onRenameFile(q.id, file.id, newName)}
                              onDelete={() => onDeleteFile(q.id, file.id)}
                            />
                          ))}
                          
                          {canEdit && !isHOD && (
                            <div className="relative pt-1">
                              <input 
                                type="file" 
                                accept=".pdf" 
                                multiple
                                id={`file-${q.id}`}
                                className="hidden" 
                                onChange={(e) => onFileUpload(q.id, e)} 
                              />
                              <label 
                                htmlFor={`file-${q.id}`}
                                className="flex items-center justify-center gap-1.5 w-full py-2 border border-dashed border-slate-300 hover:border-indigo-500 rounded-lg text-slate-500 hover:text-indigo-600 cursor-pointer transition-colors text-[11px] font-bold bg-white"
                              >
                                <Upload size={14} />
                                <span>Muat Naik PDF Lampiran Sokongan</span>
                              </label>
                            </div>
                          )}
                        </div>

                        {/* Audit Log / Informer */}
                        {itemData.updatedBy && (
                          <div className="mt-2.5 p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-start gap-2.5 shadow-3xs">
                            <User size={14} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                            <div className="text-[10px] text-indigo-900 leading-normal">
                              <span>Kemas Kini Terakhir oleh <strong>{itemData.updatedBy}</strong></span>
                              <div className="text-indigo-600 font-semibold mt-0.5 flex items-center gap-1">
                                <Clock size={10} /> 
                                <span>{itemData.updatedAt}</span>
                                {itemData.lastAction && <span>• {itemData.lastAction}</span>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status & Review Comments Cell */}
                    <td className="p-4 align-top">
                      <div className="space-y-3">
                        
                        {/* Status Select Field */}
                        {isCoord ? (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Status Kualiti</label>
                            <select
                              value={itemData.status}
                              onChange={(e) => onUpdateStatus(q.id, e.target.value)}
                              className={`w-full p-2.5 rounded-lg border text-xs font-bold outline-none cursor-pointer
                                ${itemData.status === 'completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                                  itemData.status === 'in_progress' ? 'bg-amber-50 border-amber-200 text-amber-700' : 
                                  'bg-slate-50 border-slate-200 text-slate-600'}`}
                            >
                              <option value="pending">Belum Dimulakan (Pending)</option>
                              <option value="in_progress">Dalam Proses Penyediaan</option>
                              <option value="completed">Disahkan Selesai (Completed)</option>
                            </select>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Status Kualiti</span>
                            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide
                                ${itemData.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 
                                  itemData.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 
                                  'bg-slate-100 text-slate-600'}`}
                            >
                              {itemData.status === 'completed' ? <CheckCircle size={12}/> : 
                               itemData.status === 'in_progress' ? <Clock size={12}/> : 
                               <AlertCircle size={12}/>}
                              <span>{itemData.status === 'completed' ? 'Selesai' : 
                                    itemData.status === 'in_progress' ? 'Proses' : 'Pending'}</span>
                            </div>
                          </div>
                        )}

                        {/* Collapsible Comments Section */}
                        <div className="pt-2 space-y-2.5">
                          {/* Coordinator Remarks */}
                          <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-blue-800 uppercase tracking-wide">
                              <MessageSquare size={12} /> 
                              <span>Nota Penyelaras</span>
                            </div>
                            {isCoord ? (
                              <textarea
                                className="w-full p-2 text-xs border border-blue-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none resize-none bg-white font-medium text-slate-700"
                                rows={2}
                                placeholder="Tinggalkan catatan pembetulan, kod rujukan MQA, dsb..."
                                value={itemData.comment || ''}
                                onChange={(e) => onUpdateComment(q.id, e.target.value, 'coordinator')}
                              />
                            ) : (
                              <p className={`text-[11px] leading-relaxed font-medium ${itemData.comment ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                                {itemData.comment || 'Tiada maklum balas setakat ini.'}
                              </p>
                            )}
                          </div>

                          {/* HOD Remarks */}
                          <div className="bg-purple-50/50 p-2.5 rounded-lg border border-purple-100">
                            <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-purple-800 uppercase tracking-wide">
                              <MessageSquare size={12} /> 
                              <span>Ulasan Ketua Jabatan</span>
                            </div>
                            {isHOD ? (
                              <textarea
                                className="w-full p-2 text-xs border border-purple-200 rounded-md focus:ring-1 focus:ring-purple-500 outline-none resize-none bg-white font-medium text-slate-700"
                                rows={2}
                                placeholder="Masukkan maklum balas pengurusan tertinggi..."
                                value={itemData.hodComment || ''}
                                onChange={(e) => onUpdateComment(q.id, e.target.value, 'hod')}
                              />
                            ) : (
                              <p className={`text-[11px] leading-relaxed font-medium ${itemData.hodComment ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                                {itemData.hodComment || 'Tiada ulasan rasmi pentadbiran.'}
                              </p>
                            )}
                          </div>
                        </div>

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Answer Preview Screen Modal */}
      {expandedQuestion && (
        <AnswerModal 
          isOpen={true}
          onClose={() => setExpandedQId(null)}
          question={expandedQuestion}
          itemData={data[expandedQId as string]}
          canEdit={canEdit && !isHOD}
          onUpdateAnswer={onUpdateAnswer}
        />
      )}
    </div>
  );
}

// --- FILE PDF ITEM DISPLAY ---
interface FileItemProps {
  key?: string;
  file: FileItemType;
  canEdit: boolean;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

function FileItem({ file, canEdit, onRename, onDelete }: FileItemProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(file.name);

  const handleSave = () => {
    if (editName.trim()) {
      onRename(editName);
    } else {
      setEditName(file.name); 
    }
    setIsEditing(false);
  };

  return (
    <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs group transition-all">
      <div className="flex items-center gap-2 truncate flex-1 mr-2 font-medium">
        <FileText className="text-emerald-600 flex-shrink-0" size={16} />
        {isEditing ? (
          <input 
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 px-2 py-1 border border-emerald-400 rounded-md outline-none bg-white focus:ring-1 focus:ring-emerald-500 text-xs font-semibold text-emerald-900"
            autoFocus
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        ) : (
          <span className="truncate text-emerald-800 font-bold" title={file.name}>{file.name}</span>
        )}
        <span className="text-emerald-600/70 text-[10px] shrink-0 font-medium font-mono">({file.size})</span>
      </div>
      
      {canEdit && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {isEditing ? (
            <button onClick={handleSave} className="p-1 px-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 cursor-pointer" title="Simpan">
              <Save size={12} />
            </button>
          ) : (
            <button onClick={() => setIsEditing(true)} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer" title="Tukar Nama">
              <Edit2 size={12} />
            </button>
          )}
          <button onClick={onDelete} className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors cursor-pointer" title="Padam Fail">
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// --- FULL SIZE POPUP MODAL ---
interface AnswerModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuestionType;
  itemData: QuestionState;
  canEdit: boolean;
  onUpdateAnswer: (id: string, value: string) => void;
}

function AnswerModal({ isOpen, onClose, question, itemData, canEdit, onUpdateAnswer }: AnswerModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FileCheck className="text-indigo-600" size={18} />
            <h3 className="font-bold text-slate-800 text-sm">
              Skrin Pratonton & Penyuntingan Kriteria: {question.id}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
            <p className="text-xs sm:text-sm text-indigo-950 font-semibold leading-relaxed">
              <span className="font-extrabold mr-1 bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider text-[10px]">Keperluan MQA:</span>
              {question.text}
            </p>
          </div>
          
          <div className="flex flex-col flex-1 min-h-[300px]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Draf Kandungan / Rujukan Fail</label>
            <RichTextEditor 
              value={itemData.answer}
              onChange={(val) => onUpdateAnswer(question.id, val)}
              disabled={!canEdit}
              placeholder={!canEdit ? "Mod kunci MQA aktif: Kandungan tidak dapat disunting." : "Tulis data sedia ada atau pelan rancangan program secara komprehensif di sini..."}
              minHeight="35vh"
            />
          </div>
        </div>
        
        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50 rounded-b-2xl">
          <div className="text-[10px] text-slate-500 leading-normal flex items-start gap-1">
            {itemData.updatedBy ? (
              <div>
                <span>Disediakan oleh <strong className="text-indigo-700">{itemData.updatedBy}</strong></span>
                <div className="text-slate-400 mt-0.5 font-mono">Kemaskini: {itemData.updatedAt}</div>
              </div>
            ) : (
              <span className="italic font-medium">Draft kosong, belum diisi</span>
            )}
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle size={14} />
            <span>Simpan & Papar Selesai</span>
          </button>
        </div>
      </div>
    </div>
  );
}
