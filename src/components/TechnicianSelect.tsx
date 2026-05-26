import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

interface TechProfile {
  name: string;
  user_id: string;
}

interface Props {
  value: string;
  onSelect: (name: string, userId: string) => void;
  className?: string;
}

export default function TechnicianSelect({ value, onSelect, className }: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [technicians, setTechnicians] = useState<TechProfile[]>([]);
  const [filtered, setFiltered] = useState<TechProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("field_emp_profiles")
      .select("name, user_id")
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (data) setTechnicians(data as TechProfile[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync inputValue when parent resets the value (e.g. form reset)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const applyFilter = (query: string) => {
    const q = query.trim().toLowerCase();
    setFiltered(
      q
        ? technicians.filter((t) => t.name?.toLowerCase().includes(q))
        : technicians
    );
  };

  const handleInput = (val: string) => {
    setInputValue(val);
    applyFilter(val);
    setOpen(true);
    // If user cleared the field, clear the UUID too
    if (!val.trim()) onSelect("", "");
  };

  const handleFocus = () => {
    applyFilter(inputValue);
    setOpen(true);
  };

  const handleSelect = (tech: TechProfile) => {
    const name = tech.name || "";
    setInputValue(name);
    onSelect(name, tech.user_id);
    setOpen(false);
  };

  return (
    <div className="tech-autocomplete" ref={containerRef}>
      <input
        className={`form-input ${className || ""}`}
        placeholder={loading ? "Loading technicians…" : "Search or select technician"}
        value={inputValue}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={handleFocus}
        autoComplete="off"
        disabled={loading}
      />
      {open && filtered.length > 0 && (
        <ul className="tech-dropdown">
          {filtered.map((tech) => (
            <li
              key={tech.user_id}
              className="tech-dropdown-item"
              onMouseDown={() => handleSelect(tech)}
            >
              <span className="tech-dropdown-name">{tech.name}</span>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && filtered.length === 0 && inputValue.trim() && (
        <div className="tech-dropdown tech-dropdown-empty">No technician found</div>
      )}
    </div>
  );
}
