import { useEffect, useMemo, useState } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import "./App.css";

const STORAGE_KEYS = {
  pets: "pawmeds_pets",
  medications: "pawmeds_medications",
  vetNote: "pawmeds_vet_note",
  profileName: "pawmeds_profile_name",
  notifications: "pawmeds_notifications",
  darkMode: "pawmeds_dark_mode",
  history: "pawmeds_history",
};

const DEFAULT_PETS = [
  { id: "pet-max", name: "Max", type: "Dog", age: 5 },
  { id: "pet-luna", name: "Luna", type: "Cat", age: 3 },
];

const DEFAULT_MEDICATIONS = [
  {
    id: "med-amoxicillin",
    pet: "Max",
    medicine: "Amoxicillin",
    dose: "250 mg",
    time: "09:00",
    completed: true,
    reminder: true,
  },
  {
    id: "med-prednisone",
    pet: "Luna",
    medicine: "Prednisone",
    dose: "5 mg",
    time: "14:00",
    completed: false,
    reminder: true,
  },
  {
    id: "med-vitamin",
    pet: "Max",
    medicine: "Vitamin Supplement",
    dose: "1 tablet",
    time: "20:00",
    completed: false,
    reminder: true,
  },
];

const DEFAULT_VET_NOTE =
  "Max should take his medication with food. Follow the prescribed schedule and contact your veterinarian if you have concerns.";

const NAV_ITEMS = [
  ["🏠", "Dashboard"],
  ["🐶", "My Pets"],
  ["💊", "Medications"],
  ["⏰", "Reminders"],
  ["📋", "Vet Notes"],
  ["📊", "History"],
];

const MOBILE_NAV_ITEMS = [
  ["🏠", "Dashboard", "Home"],
  ["🐶", "My Pets", "Pets"],
  ["💊", "Medications", "Meds"],
  ["⏰", "Reminders", "Remind"],
  ["📋", "Vet Notes", "Vet"],
  ["📊", "History", "History"],
  ["⚙️", "Settings", "Settings"],
];

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);

    if (!saved) return fallback;

    const parsed = JSON.parse(saved);
    return parsed;
  } catch {
    return fallback;
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
function getNotificationId(medicationId) {
  let hash = 0;

  for (let index = 0; index < medicationId.length; index += 1) {
    hash = (hash * 31 + medicationId.charCodeAt(index)) >>> 0;
  }

  return Math.max(1, hash % 2147483647);
}

function getNextMedicationDate(time) {
  const [hour, minute] = time.split(":").map(Number);

  const now = new Date();
  const scheduled = new Date(now);

  scheduled.setHours(hour, minute, 0, 0);

  if (scheduled <= now) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  return scheduled;
}

async function scheduleMedicationNotification(medication) {
  const permission = await LocalNotifications.requestPermissions();

  if (permission.display !== "granted") {
    return;
  }

  const notificationId = getNotificationId(medication.id);

  await LocalNotifications.cancel({
    notifications: [{ id: notificationId }],
  });

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: `PawMeds Reminder 🐾`,
        body: `${medication.medicine} — ${medication.dose} for ${medication.pet}`,
        schedule: {
          at: getNextMedicationDate(medication.time),
          repeats: true,
        },
        autoCancel: true,
        foreground: true,
      },
    ],
  });
}

async function cancelMedicationNotification(medicationId) {
  const notificationId = getNotificationId(medicationId);

  await LocalNotifications.cancel({
    notifications: [{ id: notificationId }],
  });
}

function getPetEmoji(type) {
  return type === "Cat" ? "🐱" : "🐶";
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "Good morning 👋";
  if (hour >= 12 && hour < 17) return "Good afternoon 👋";
  if (hour >= 17 && hour < 22) return "Good evening 👋";
  return "Good night 👋";
}

function formatTime(time) {
  if (!time) return "";

  const [hours, minutes] = time.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )} ${period}`;
}

function isToday(dateValue) {
  const date = new Date(dateValue);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [greeting, setGreeting] = useState(getGreeting);

  useEffect(() => {
    const updateGreeting = () => setGreeting(getGreeting());
    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [showPetModal, setShowPetModal] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null);
  const [showVetModal, setShowVetModal] = useState(false);
  const [editingMedicationId, setEditingMedicationId] = useState(null);

  const [pets, setPets] = useState(() => {
    const saved = readStorage(STORAGE_KEYS.pets, DEFAULT_PETS);

    if (!Array.isArray(saved)) return DEFAULT_PETS;

    return saved.map((pet, index) => ({
      id: pet.id || `pet-${index}-${pet.name || "pet"}`,
      name: pet.name || "Unnamed Pet",
      type: pet.type || "Dog",
      age: Number(pet.age) || 0,
    }));
  });

  const [medications, setMedications] = useState(() => {
    const saved = readStorage(
      STORAGE_KEYS.medications,
      DEFAULT_MEDICATIONS
    );

    if (!Array.isArray(saved)) return DEFAULT_MEDICATIONS;

    return saved.map((medication, index) => ({
      id:
        medication.id ||
        `med-${index}-${medication.medicine || "medicine"}`,
      pet: medication.pet || "",
      medicine: medication.medicine || "",
      dose: medication.dose || "",
      time: medication.time || "",
      completed: Boolean(medication.completed),
      reminder: medication.reminder !== false,
    }));
  });

  const [history, setHistory] = useState(() => {
    const saved = readStorage(STORAGE_KEYS.history, []);
    return Array.isArray(saved) ? saved : [];
  });

  const [vetNote, setVetNote] = useState(() => {
    return (
      localStorage.getItem(STORAGE_KEYS.vetNote) || DEFAULT_VET_NOTE
    );
  });

  const [form, setForm] = useState({
    pet: "",
    medicine: "",
    dose: "",
    time: "",
  });

  const [petForm, setPetForm] = useState({
    name: "",
    type: "Dog",
    age: "",
  });

  const [profileName, setProfileName] = useState(() => {
    return (
      localStorage.getItem(STORAGE_KEYS.profileName) || "Pet Owner"
    );
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.notifications);
    return saved === null ? true : saved === "true";
  });

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.darkMode) === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.pets, JSON.stringify(pets));
  }, [pets]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.medications,
      JSON.stringify(medications)
    );
  }, [medications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.vetNote, vetNote);
  }, [vetNote]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.profileName, profileName);
  }, [profileName]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.notifications,
      String(notificationsEnabled)
    );
  }, [notificationsEnabled]);
  useEffect(() => {
  async function syncMedicationNotifications() {
    if (!notificationsEnabled) {
      await LocalNotifications.cancelAll();
      return;
    }

    const permission = await LocalNotifications.checkPermissions();

    if (permission.display !== "granted") {
      const requestedPermission =
        await LocalNotifications.requestPermissions();

      if (requestedPermission.display !== "granted") {
        return;
      }
    }

    for (const medication of medications) {
      if (medication.reminder) {
        await scheduleMedicationNotification(medication);
      } else {
        await cancelMedicationNotification(medication.id);
      }
    }
  }

  syncMedicationNotifications().catch((error) => {
    console.error("Failed to sync medication notifications:", error);
  });
}, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.darkMode, String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (pets.length === 0) {
      setForm((current) => ({ ...current, pet: "" }));
      return;
    }

    setForm((current) => {
      const petStillExists = pets.some(
        (pet) => pet.name === current.pet
      );

      return petStillExists
        ? current
        : { ...current, pet: pets[0].name };
    });
  }, [pets]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;

      setShowModal(false);
      setShowPetModal(false);
      setShowVetModal(false);
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const todayHistoryCount = useMemo(
    () => history.filter((item) => isToday(item.completedAt)).length,
    [history]
  );

  function goToPage(page) {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleMedicationChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openMedicationModal() {
    if (pets.length === 0) {
      alert("Please add a pet before adding medication.");
      setActivePage("My Pets");
      return;
    }

    setForm((current) => ({
      ...current,
      pet: pets.some((pet) => pet.name === current.pet)
        ? current.pet
        : pets[0].name,
    }));

    setEditingMedicationId(null);
    setShowModal(true);
  }

  function openPetModal() {
    setEditingPetId(null);

    setPetForm({
      name: "",
      type: "Dog",
      age: "",
    });

    setShowPetModal(true);
  }

  function addMedication(event) {
    event.preventDefault();

    const medicine = form.medicine.trim();
    const dose = form.dose.trim();
    const time = form.time.trim();

    if (!form.pet || !medicine || !dose || !time) {
      alert("Please fill all medication fields.");
      return;
    }

    if (dose.length > 40) {
      alert("Dose must be 40 characters or less.");
      return;
    }

    const petExists = pets.some((pet) => pet.name === form.pet);

    if (!petExists) {
      alert("Please select a valid pet.");
      return;
    }

    const duplicateMedication = medications.some(
      (item) =>
        item.id !== editingMedicationId &&
        item.pet === form.pet &&
        item.medicine.toLowerCase() === medicine.toLowerCase()
    );

    if (duplicateMedication) {
      alert("This medication is already added for this pet.");
      return;
    }

    if (editingMedicationId) {
      const updatedMedication = {
        id: editingMedicationId,
        pet: form.pet,
        medicine,
        dose,
        time,
        completed:
          medications.find((item) => item.id === editingMedicationId)
            ?.completed ?? false,
        reminder:
          medications.find((item) => item.id === editingMedicationId)
            ?.reminder ?? true,
      };

      setMedications((current) =>
        current.map((item) =>
          item.id === editingMedicationId
            ? updatedMedication
            : item
        )
      );

      if (notificationsEnabled && updatedMedication.reminder) {
        scheduleMedicationNotification(updatedMedication).catch((error) => {
          console.error("Failed to schedule notification:", error);
        });
      } else {
        cancelMedicationNotification(updatedMedication.id).catch((error) => {
          console.error("Failed to cancel notification:", error);
        });
      }
    } else {
      const newMedication = {
        id: createId("med"),
        pet: form.pet,
        medicine,
        dose,
        time,
        completed: false,
        reminder: true,
      };

      setMedications((current) => [...current, newMedication]);

      if (notificationsEnabled) {
        scheduleMedicationNotification(newMedication).catch((error) => {
          console.error("Failed to schedule notification:", error);
        });
      }
    }

    setForm({
      pet: form.pet,
      medicine: "",
      dose: "",
      time: "",
    });

    setEditingMedicationId(null);
    setShowModal(false);
  }
  function editMedication(id) {
    const medication = medications.find((item) => item.id === id);

    if (!medication) return;

    setForm({
      pet: medication.pet,
      medicine: medication.medicine,
      dose: medication.dose,
      time: medication.time,
    });

    setEditingMedicationId(id);
    setShowModal(true);
  }

  function deleteMedication(id) {
    const medication = medications.find((item) => item.id === id);

    if (!medication) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${medication.medicine}?`
    );

    if (!confirmed) return;
    cancelMedicationNotification(id).catch((error) => {
      console.error("Failed to cancel notification:", error);
    });
    setMedications((current) =>
      current.filter((item) => item.id !== id)
    );

    setHistory((current) =>
      current.filter((item) => item.medicationId !== id)
    );
  }

  function markDone(id) {
    const medication = medications.find((item) => item.id === id);

    if (!medication) return;

    const newCompletedStatus = !medication.completed;

    setMedications((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, completed: newCompletedStatus }
          : item
      )
    );

    if (newCompletedStatus) {
      setHistory((current) => [
        {
          id: createId("history"),
          medicationId: medication.id,
          pet: medication.pet,
          medicine: medication.medicine,
          dose: medication.dose,
          time: medication.time,
          completedAt: new Date().toISOString(),
        },
        ...current,
      ]);
    }
  }

  function toggleReminder(id) {
    setMedications((current) => {
      const updatedMedications = current.map((item) =>
        item.id === id
          ? { ...item, reminder: !item.reminder }
          : item
      );

      const updatedMedication = updatedMedications.find(
        (item) => item.id === id
      );

      if (updatedMedication) {
        if (updatedMedication.reminder && notificationsEnabled) {
          scheduleMedicationNotification(updatedMedication).catch((error) => {
            console.error("Failed to schedule notification:", error);
          });
        } else {
          cancelMedicationNotification(updatedMedication.id).catch((error) => {
            console.error("Failed to cancel notification:", error);
          });
        }
      }

      return updatedMedications;
    });
  }

  function handlePetChange(event) {
    const { name, value } = event.target;

    setPetForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function addPet(event) {
    event.preventDefault();

    const name = petForm.name.trim();
    const age = Number(petForm.age);

    if (!name || petForm.age === "") {
      alert("Please fill all pet fields.");
      return;
    }

    if (!Number.isFinite(age) || age < 0 || age > 100) {
      alert("Please enter a valid pet age.");
      return;
    }

    const duplicate = pets.some(
      (pet) =>
        pet.id !== editingPetId &&
        pet.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      alert("A pet with this name already exists.");
      return;
    }

    if (editingPetId) {
      const oldPet = pets.find((pet) => pet.id === editingPetId);

      setPets((current) =>
        current.map((pet) =>
          pet.id === editingPetId
            ? {
              ...pet,
              name,
              type: petForm.type,
              age,
            }
            : pet
        )
      );

      if (oldPet && oldPet.name !== name) {
        setMedications((current) =>
          current.map((medication) =>
            medication.pet === oldPet.name
              ? { ...medication, pet: name }
              : medication
          )
        );

        setHistory((current) =>
          current.map((item) =>
            item.pet === oldPet.name
              ? { ...item, pet: name }
              : item
          )
        );
      }
    } else {
      setPets((current) => [
        ...current,
        {
          id: createId("pet"),
          name,
          type: petForm.type,
          age,
        },
      ]);
    }

    setEditingPetId(null);

    setPetForm({
      name: "",
      type: "Dog",
      age: "",
    });

    setShowPetModal(false);
  }

  function editPet(id) {
    const pet = pets.find((item) => item.id === id);

    if (!pet) return;

    setPetForm({
      name: pet.name,
      type: pet.type,
      age: String(pet.age),
    });

    setEditingPetId(id);
    setShowPetModal(true);
  }

  function deletePet(id) {
    const pet = pets.find((item) => item.id === id);

    if (!pet) return;

    const petMedications = medications.filter(
      (medication) => medication.pet === pet.name
    );

    if (petMedications.length > 0) {
      alert(
        `Cannot delete ${pet.name} because ${petMedications.length} medication(s) are associated with this pet.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${pet.name}?`
    );

    if (!confirmed) return;

    setPets((current) => current.filter((item) => item.id !== id));
  }

  function clearAllData() {
    const confirmed = window.confirm(
      "Are you sure you want to delete all PawMeds data? This cannot be undone."
    );

    if (!confirmed) return;

    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });

    setPets([]);
    setMedications([]);
    setHistory([]);
    setVetNote("");
    setProfileName("Pet Owner");
    setNotificationsEnabled(true);
    setDarkMode(false);
    setActivePage("Dashboard");
  }

  const pageAction = {
    Dashboard: {
      label: "+ Add Medication",
      onClick: openMedicationModal,
    },
    "My Pets": {
      label: "+ Add New Pet",
      onClick: openPetModal,
    },
    Medications: {
      label: "+ Add Medication",
      onClick: openMedicationModal,
    },
    Reminders: {
      label: "+ Add Medication",
      onClick: openMedicationModal,
    },
    "Vet Notes": {
      label: "+ Edit Notes",
      onClick: () => setShowVetModal(true),
    },
  };

  const currentAction = pageAction[activePage];

  return (
    <div className={`app ${darkMode ? "dark-mode" : ""}`}>
      {/* DESKTOP SIDEBAR */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">🐾</div>
          <span>PawMeds</span>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {NAV_ITEMS.map(([icon, name]) => (
            <button
              key={name}
              type="button"
              className={`nav-item ${activePage === name ? "active" : ""
                }`}
              onClick={() => goToPage(name)}
            >
              <span className="nav-icon" aria-hidden="true">
                {icon}
              </span>
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={`nav-item ${activePage === "Settings" ? "active" : ""
              }`}
            onClick={() => goToPage("Settings")}
          >
            <span className="nav-icon" aria-hidden="true">
              ⚙️
            </span>
            <span>Settings</span>
          </button>

          <div className="profile">
            <div className="avatar">
              {profileName.trim().charAt(0).toUpperCase() || "P"}
            </div>

            <div>
              <strong>{profileName || "Pet Owner"}</strong>
              <small>My Account</small>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        <header className="topbar">
          <div>
            <p className="greeting">{greeting}</p>
            <h1>{activePage}</h1>
          </div>

          {currentAction && (
            <button
              type="button"
              className="add-btn"
              onClick={currentAction.onClick}
            >
              {currentAction.label}
            </button>
          )}
        </header>

        {/* DASHBOARD */}
        {activePage === "Dashboard" && (
          <>
            <section className="stats">
              <div className="stat-card">
                <div className="stat-icon blue">🐾</div>
                <div>
                  <span>Total Pets</span>
                  <strong>{pets.length}</strong>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon purple">💊</div>
                <div>
                  <span>Active Medications</span>
                  <strong>{medications.length}</strong>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon orange">⏰</div>
                <div>
                  <span>Today's Doses</span>
                  <strong>{medications.length}</strong>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon green">✓</div>
                <div>
                  <span>Completed Today</span>
                  <strong>{todayHistoryCount}</strong>
                </div>
              </div>
            </section>

            <section className="content-grid">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>Today's Medication</h2>
                    <p>Keep your pets on schedule</p>
                  </div>

                  <button
                    type="button"
                    className="view-btn"
                    onClick={() => goToPage("Medications")}
                  >
                    View all
                  </button>
                </div>

                {medications.length === 0 ? (
                  <p className="empty-state">
                    No medications added yet.
                  </p>
                ) : (
                  medications.map((item) => (
                    <div className="medication" key={item.id}>
                      <div className="pet-avatar">
                        {getPetEmoji(
                          pets.find((pet) => pet.name === item.pet)?.type
                        )}
                      </div>

                      <div className="med-info">
                        <strong>
                          {item.pet} — {item.medicine}
                        </strong>
                        <span>{item.dose} · Oral</span>
                      </div>

                      <div className="dose-time">
                        <strong>{formatTime(item.time)}</strong>
                        <span>Scheduled dose</span>
                      </div>

                      <button
                        type="button"
                        className={
                          item.completed ? "done-btn" : "mark-btn"
                        }
                        onClick={() => markDone(item.id)}
                      >
                        {item.completed ? "✓ Done" : "Mark done"}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>My Pets</h2>
                    <p>Your pet profiles</p>
                  </div>

                  <button
                    type="button"
                    className="view-btn"
                    onClick={() => goToPage("My Pets")}
                  >
                    View all
                  </button>
                </div>

                {pets.length === 0 ? (
                  <p className="empty-state">No pets added yet.</p>
                ) : (
                  pets.map((pet) => (
                    <div className="pet" key={pet.id}>
                      <div className="large-pet">
                        {getPetEmoji(pet.type)}
                      </div>

                      <div>
                        <strong>{pet.name}</strong>
                        <span>
                          {pet.type} · {pet.age} years
                        </span>
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  className="add-pet"
                  onClick={openPetModal}
                >
                  + Add New Pet
                </button>
              </div>
            </section>

            <section className="card vet-card">
              <div className="vet-icon">🩺</div>

              <div>
                <h2>Vet Instructions</h2>
                <p>{vetNote || "No veterinary notes added yet."}</p>
              </div>

              <button
                type="button"
                className="view-btn"
                onClick={() => setShowVetModal(true)}
              >
                View notes
              </button>
            </section>
          </>
        )}

        {/* MY PETS */}
        {activePage === "My Pets" && (
          <section className="card page-card">
            <div className="card-header">
              <div>
                <h2>My Pets</h2>
                <p>Manage your pets and their care information</p>
              </div>

              <button
                type="button"
                className="add-btn"
                onClick={openPetModal}
              >
                + Add New Pet
              </button>
            </div>

            {pets.length === 0 ? (
              <p className="empty-state">
                No pets yet. Add your first pet to get started.
              </p>
            ) : (
              <div className="pet-grid">
                {pets.map((pet) => (
                  <div className="pet-card" key={pet.id}>
                    <div className="pet">
                      <div className="large-pet">
                        {getPetEmoji(pet.type)}
                      </div>

                      <div>
                        <strong>{pet.name}</strong>
                        <span>
                          {pet.type} · {pet.age} years old
                        </span>
                      </div>
                    </div>

                    <div className="pet-meta">
                      <span>Active medications</span>
                      <strong>
                        {
                          medications.filter(
                            (medication) => medication.pet === pet.name
                          ).length
                        }
                      </strong>
                    </div>

                    <div className="action-row">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => editPet(pet.id)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => deletePet(pet.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* MEDICATIONS */}
        {activePage === "Medications" && (
          <section className="card page-card">
            <div className="card-header">
              <div>
                <h2>All Medications</h2>
                <p>Manage your pets' medication schedule</p>
              </div>

              <button
                type="button"
                className="add-btn"
                onClick={openMedicationModal}
              >
                + Add Medication
              </button>
            </div>

            {medications.length === 0 ? (
              <p className="empty-state">No medications added yet.</p>
            ) : (
              <div className="list-container">
                {medications.map((item) => (
                  <div className="medication" key={item.id}>
                    <div className="pet-avatar">
                      {getPetEmoji(
                        pets.find((pet) => pet.name === item.pet)?.type
                      )}
                    </div>

                    <div className="med-info">
                      <strong>{item.medicine}</strong>
                      <span>
                        {item.pet} · {item.dose} · Oral
                      </span>
                    </div>

                    <div className="dose-time">
                      <strong>{formatTime(item.time)}</strong>
                      <span>
                        {notificationsEnabled && item.reminder
                          ? "🔔 Reminder ON"
                          : "🔕 Reminder OFF"}
                      </span>
                    </div>

                    <div className="action-row compact">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => editMedication(item.id)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => deleteMedication(item.id)}
                      >
                        Delete
                      </button>

                      <button
                        type="button"
                        className={
                          item.completed ? "done-btn" : "mark-btn"
                        }
                        onClick={() => markDone(item.id)}
                      >
                        {item.completed ? "✓ Done" : "Mark done"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* REMINDERS */}
        {activePage === "Reminders" && (
          <section className="card page-card">
            <div className="card-header">
              <div>
                <h2>Medication Reminders</h2>
                <p>Keep track of upcoming doses</p>
              </div>
            </div>

            {medications.length === 0 ? (
              <p className="empty-state">
                No medication reminders available.
              </p>
            ) : (
              <div className="list-container">
                {medications.map((item) => (
                  <div className="medication" key={item.id}>
                    <div className="pet-avatar">
                      {getPetEmoji(
                        pets.find((pet) => pet.name === item.pet)?.type
                      )}
                    </div>

                    <div className="med-info">
                      <strong>{item.medicine}</strong>
                      <span>
                        {item.pet} · {item.dose}
                      </span>
                    </div>

                    <div className="dose-time">
                      <strong>{formatTime(item.time)}</strong>
                      <span>
                        {notificationsEnabled && item.reminder
                          ? "Reminder enabled"
                          : "Reminder disabled"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => toggleReminder(item.id)}
                      disabled={!notificationsEnabled}
                      title={
                        notificationsEnabled
                          ? "Toggle reminder"
                          : "Enable notifications in Settings first"
                      }
                    >
                      {notificationsEnabled && item.reminder
                        ? "🔔 ON"
                        : "🔕 OFF"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* VET NOTES */}
        {activePage === "Vet Notes" && (
          <section className="card page-card">
            <div className="card-header">
              <div>
                <h2>Vet Instructions</h2>
                <p>Important notes from your veterinarian</p>
              </div>

              <button
                type="button"
                className="add-btn"
                onClick={() => setShowVetModal(true)}
              >
                + Edit Notes
              </button>
            </div>

            <div className="vet-card vet-page">
              <div className="vet-icon">🩺</div>

              <div>
                <h2>Veterinarian Instructions</h2>
                <p>{vetNote || "No veterinary notes added yet."}</p>
              </div>
            </div>
          </section>
        )}

        {/* HISTORY */}
        {activePage === "History" && (
          <section className="card page-card">
            <div className="card-header">
              <div>
                <h2>Medication History</h2>
                <p>Track completed doses</p>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="empty-state">No medication history yet.</p>
            ) : (
              <div className="list-container">
                {history.map((item) => (
                  <div className="medication" key={item.id}>
                    <div className="pet-avatar">
                      {getPetEmoji(
                        pets.find((pet) => pet.name === item.pet)?.type
                      )}
                    </div>

                    <div className="med-info">
                      <strong>{item.medicine}</strong>
                      <span>
                        {item.pet} · {item.dose}
                      </span>
                    </div>

                    <div className="dose-time">
                      <strong>{formatTime(item.time)}</strong>
                      <span>
                        {new Date(item.completedAt).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    <span className="done-btn history-status">
                      ✓ Completed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* SETTINGS */}
        {activePage === "Settings" && (
          <section className="card page-card">
            <div className="card-header">
              <div>
                <h2>Settings</h2>
                <p>Manage your PawMeds preferences</p>
              </div>
            </div>

            <div className="settings-section">
              <div>
                <h3>Profile</h3>
                <p>Manage your account information</p>
              </div>

              <div className="settings-profile">
                <div className="avatar">
                  {profileName.trim().charAt(0).toUpperCase() || "P"}
                </div>

                <div>
                  <strong>{profileName || "Pet Owner"}</strong>
                  <span>My Account</span>
                </div>
              </div>
            </div>

            <input
              type="text"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className="settings-input"
              placeholder="Enter your name"
              maxLength={40}
            />

            <div className="settings-section">
              <div>
                <h3>Notifications</h3>
                <p>Receive medication reminder notifications</p>
              </div>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setNotificationsEnabled(enabled);

                    if (!enabled) {
                      medications.forEach((medication) => {
                        cancelMedicationNotification(medication.id).catch((error) => {
                          console.error("Failed to cancel notification:", error);
                        });
                      });
                    } else {
                      medications
                        .filter((medication) => medication.reminder)
                        .forEach((medication) => {
                          scheduleMedicationNotification(medication).catch((error) => {
                            console.error("Failed to schedule notification:", error);
                          });
                        });
                    }
                  }}
                />
                <span>
                  {notificationsEnabled
                    ? "Reminders enabled"
                    : "Reminders disabled"}
                </span>
              </label>
            </div>

            <div className="settings-section">
              <div>
                <h3>Appearance</h3>
                <p>Customize how PawMeds looks</p>
              </div>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={(event) => setDarkMode(event.target.checked)}
                />
                <span>
                  {darkMode ? "Dark Mode" : "Light Mode"}
                </span>
              </label>
            </div>

            <div className="settings-section">
              <div>
                <h3>About PawMeds</h3>
                <p>
                  PawMeds helps pet owners manage pets, medications,
                  reminders and veterinary notes.
                </p>
              </div>

              <span className="settings-value">v1.0.0</span>
            </div>

            <div className="settings-danger">
              <div>
                <h3>Clear All Data</h3>
                <p>
                  Remove all saved PawMeds data from this browser.
                </p>
              </div>

              <button
                type="button"
                className="delete-btn"
                onClick={clearAllData}
              >
                Clear Data
              </button>
            </div>
          </section>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {MOBILE_NAV_ITEMS.map(([icon, name, label]) => (
          <button
            key={name}
            type="button"
            className={`mobile-nav-item ${activePage === name ? "active" : ""
              }`}
            onClick={() => goToPage(name)}
            aria-label={name}
          >
            <span className="mobile-nav-icon" aria-hidden="true">
              {icon}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* ADD / EDIT MEDICATION MODAL */}
      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowModal(false);
              setEditingMedicationId(null);
            }
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>
                  {editingMedicationId
                    ? "Edit Medication"
                    : "Add Medication"}
                </h2>
                <p>Add medication details for your pet.</p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() => {
                  setShowModal(false);
                  setEditingMedicationId(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={addMedication}>
              <label htmlFor="med-pet">Pet</label>
              <select
                id="med-pet"
                name="pet"
                value={form.pet}
                onChange={handleMedicationChange}
                required
              >
                {pets.map((pet) => (
                  <option value={pet.name} key={pet.id}>
                    {getPetEmoji(pet.type)} {pet.name}
                  </option>
                ))}
              </select>

              <label htmlFor="medicine-name">Medicine Name</label>
              <input
                id="medicine-name"
                type="text"
                name="medicine"
                placeholder="e.g. Amoxicillin"
                value={form.medicine}
                onChange={handleMedicationChange}
                maxLength={80}
                required
              />

              <label htmlFor="dose">Dose</label>
              <input
                id="dose"
                type="text"
                name="dose"
                placeholder="e.g. 250 mg"
                value={form.dose}
                onChange={handleMedicationChange}
                maxLength={40}
                required
              />

              <label htmlFor="med-time">Time</label>
              <input
                id="med-time"
                type="time"
                name="time"
                value={form.time}
                onChange={handleMedicationChange}
                required
              />

              <button type="submit" className="save-medication">
                {editingMedicationId ? "Save Changes" : "Add Medication"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT PET MODAL */}
      {showPetModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowPetModal(false);
              setEditingPetId(null);
            }
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>{editingPetId ? "Edit Pet" : "Add New Pet"}</h2>
                <p>Create a profile for your pet.</p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() => {
                  setShowPetModal(false);
                  setEditingPetId(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={addPet}>
              <label htmlFor="pet-name">Pet Name</label>
              <input
                id="pet-name"
                type="text"
                name="name"
                placeholder="e.g. Max"
                value={petForm.name}
                onChange={handlePetChange}
                maxLength={40}
                required
              />

              <label htmlFor="pet-type">Pet Type</label>
              <select
                id="pet-type"
                name="type"
                value={petForm.type}
                onChange={handlePetChange}
              >
                <option value="Dog">🐶 Dog</option>
                <option value="Cat">🐱 Cat</option>
              </select>

              <label htmlFor="pet-age">Age</label>
              <input
                id="pet-age"
                type="number"
                name="age"
                placeholder="e.g. 5"
                min="0"
                max="100"
                value={petForm.age}
                onChange={handlePetChange}
                required
              />

              <button type="submit" className="save-medication">
                {editingPetId ? "Save Changes" : "Add Pet"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VET NOTES MODAL */}
      {showVetModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowVetModal(false);
            }
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Vet Instructions</h2>
                <p>Important notes from your veterinarian.</p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() => setShowVetModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                setShowVetModal(false);
              }}
            >
              <label htmlFor="vet-notes">Veterinarian Notes</label>

              <textarea
                id="vet-notes"
                className="vet-textarea"
                value={vetNote}
                onChange={(event) => setVetNote(event.target.value)}
                rows="6"
                placeholder="Write vet instructions..."
                maxLength={1000}
              />

              <button type="submit" className="save-medication">
                Save Notes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
