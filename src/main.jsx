import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { onValue, push, ref, remove, set } from "firebase/database";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "./firebase";
import "./styles.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const blankTimes = () => Object.fromEntries(DAYS.map(day => [day, { in: "", out: "", breakMinutes: 0 }]));
const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));

function hoursBetween(start, end, breakMinutes = 0) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  mins = Math.max(0, mins - Number(breakMinutes || 0));
  return mins / 60;
}

function App() {
  const [tab, setTab] = useState("payroll");
  const [employees, setEmployees] = useState({});
  const [history, setHistory] = useState({});
  const [selectedId, setSelectedId] = useState("");
  const [weekEnding, setWeekEnding] = useState(new Date().toISOString().slice(0, 10));
  const [times, setTimes] = useState(blankTimes());
  const [employeeForm, setEmployeeForm] = useState({ name: "", employeeId: "", email: "", phone: "", hourlyRate: "" });
  const [status, setStatus] = useState("");

  useEffect(() => onValue(ref(db, "employees"), snap => setEmployees(snap.val() || {})), []);
  useEffect(() => onValue(ref(db, "payrollHistory"), snap => setHistory(snap.val() || {})), []);

  const employeeList = useMemo(() => Object.entries(employees).map(([id, value]) => ({ id, ...value })), [employees]);
  const selectedEmployee = employees[selectedId];
  const dayHours = useMemo(() => Object.fromEntries(DAYS.map(day => [day, hoursBetween(times[day].in, times[day].out, times[day].breakMinutes)])), [times]);
  const totalHours = useMemo(() => Object.values(dayHours).reduce((a, b) => a + b, 0), [dayHours]);
  const grossPay = totalHours * Number(selectedEmployee?.hourlyRate || 0);

  const historyRows = useMemo(() => Object.entries(history)
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), [history]);

  const employeeSummary = useMemo(() => {
    const rows = {};
    historyRows.forEach(item => {
      if (!rows[item.employeeId]) rows[item.employeeId] = { employeeId: item.employeeId, employeeName: item.employeeName, hours: 0, earnings: 0, payrollCount: 0 };
      rows[item.employeeId].hours += Number(item.totalHours || 0);
      rows[item.employeeId].earnings += Number(item.grossPay || 0);
      rows[item.employeeId].payrollCount += 1;
    });
    employeeList.forEach(emp => {
      if (!rows[emp.id]) rows[emp.id] = { employeeId: emp.id, employeeName: emp.name, hours: 0, earnings: 0, payrollCount: 0 };
    });
    return Object.values(rows).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [historyRows, employeeList]);

  async function addEmployee(e) {
    e.preventDefault();
    if (!employeeForm.name.trim() || Number(employeeForm.hourlyRate) < 0) return;
    const employeeRef = push(ref(db, "employees"));
    await set(employeeRef, { ...employeeForm, hourlyRate: Number(employeeForm.hourlyRate), createdAt: new Date().toISOString() });
    setEmployeeForm({ name: "", employeeId: "", email: "", phone: "", hourlyRate: "" });
    setStatus("Employee added.");
  }

  async function deleteEmployee(id) {
    if (!confirm("Delete this employee? Existing payroll history will remain.")) return;
    await remove(ref(db, `employees/${id}`));
    if (selectedId === id) setSelectedId("");
  }

  async function savePayroll() {
    if (!selectedEmployee) return setStatus("Select an employee first.");
    if (totalHours <= 0) return setStatus("Enter at least one work shift.");
    const payrollRef = push(ref(db, "payrollHistory"));
    await set(payrollRef, {
      employeeId: selectedId,
      employeeName: selectedEmployee.name,
      employeeNumber: selectedEmployee.employeeId || "",
      hourlyRate: Number(selectedEmployee.hourlyRate),
      weekEnding,
      times,
      dayHours,
      totalHours: Number(totalHours.toFixed(2)),
      grossPay: Number(grossPay.toFixed(2)),
      createdAt: new Date().toISOString()
    });
    setTimes(blankTimes());
    setStatus("Payroll saved to Firebase history.");
    setTab("history");
  }

  async function deletePayroll(id) {
    if (!confirm("Permanently delete this past payroll record?")) return;
    await remove(ref(db, `payrollHistory/${id}`));
  }

  function exportExcel(rows = historyRows, filename = "payroll-history.xlsx") {
    const data = rows.map(r => ({
      "Employee": r.employeeName,
      "Employee ID": r.employeeNumber || "",
      "Week Ending": r.weekEnding,
      "Hourly Rate": Number(r.hourlyRate || 0),
      "Hours Worked": Number(r.totalHours || r.hours || 0),
      "Amount Earned": Number(r.grossPay || r.earnings || 0)
    }));
    const sheet = XLSX.utils.json_to_sheet(data);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Payroll");
    XLSX.writeFile(book, filename);
  }

  function exportPdf(rows = historyRows, filename = "payroll-history.pdf") {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(18);
    doc.text("Payroll Report", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Employee", "Employee ID", "Week Ending", "Hourly Rate", "Hours", "Amount Earned"]],
      body: rows.map(r => [r.employeeName, r.employeeNumber || "", r.weekEnding || "All records", money(r.hourlyRate || 0), Number(r.totalHours || r.hours || 0).toFixed(2), money(r.grossPay || r.earnings || 0)]),
      styles: { fontSize: 9 }
    });
    doc.save(filename);
  }

  return <div className="app-shell">
    <aside>
      <div className="brand">Payroll<span>Manager</span></div>
      <nav>
        {[["payroll","Weekly Payroll"],["employees","Employees"],["summary","Employee Summary"],["history","Payroll History"]].map(([key,label]) =>
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
      </nav>
    </aside>
    <main>
      <header><div><h1>{tab === "payroll" ? "Weekly Payroll" : tab === "employees" ? "Employee Setup" : tab === "summary" ? "Employee Summary" : "Payroll History"}</h1><p>Realtime payroll records powered by Firebase.</p></div></header>
      {status && <div className="notice" onClick={() => setStatus("")}>{status}</div>}

      {tab === "payroll" && <section>
        <div className="card top-grid">
          <label>Employee<select value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Select employee</option>{employeeList.map(emp => <option key={emp.id} value={emp.id}>{emp.name} — {money(emp.hourlyRate)}/hr</option>)}</select></label>
          <label>Week ending<input type="date" value={weekEnding} onChange={e => setWeekEnding(e.target.value)} /></label>
          <div className="metric"><span>Hourly rate</span><strong>{money(selectedEmployee?.hourlyRate)}</strong></div>
        </div>
        <div className="card table-wrap"><table><thead><tr><th>Day</th><th>Clock In</th><th>Clock Out</th><th>Break (min)</th><th>Hours</th></tr></thead><tbody>{DAYS.map(day => <tr key={day}><td><strong>{day}</strong></td><td><input type="time" value={times[day].in} onChange={e => setTimes(t => ({...t,[day]:{...t[day],in:e.target.value}}))}/></td><td><input type="time" value={times[day].out} onChange={e => setTimes(t => ({...t,[day]:{...t[day],out:e.target.value}}))}/></td><td><input type="number" min="0" value={times[day].breakMinutes} onChange={e => setTimes(t => ({...t,[day]:{...t[day],breakMinutes:e.target.value}}))}/></td><td>{dayHours[day].toFixed(2)}</td></tr>)}</tbody></table></div>
        <div className="totals"><div><span>Total hours</span><strong>{totalHours.toFixed(2)}</strong></div><div><span>Gross pay</span><strong>{money(grossPay)}</strong></div><button className="primary" onClick={savePayroll}>Save Payroll</button></div>
      </section>}

      {tab === "employees" && <section className="split">
        <form className="card form" onSubmit={addEmployee}><h2>Add new employee</h2><label>Full name<input required value={employeeForm.name} onChange={e => setEmployeeForm({...employeeForm,name:e.target.value})}/></label><label>Employee ID<input value={employeeForm.employeeId} onChange={e => setEmployeeForm({...employeeForm,employeeId:e.target.value})}/></label><label>Email<input type="email" value={employeeForm.email} onChange={e => setEmployeeForm({...employeeForm,email:e.target.value})}/></label><label>Phone<input value={employeeForm.phone} onChange={e => setEmployeeForm({...employeeForm,phone:e.target.value})}/></label><label>Hourly rate<input required type="number" min="0" step="0.01" value={employeeForm.hourlyRate} onChange={e => setEmployeeForm({...employeeForm,hourlyRate:e.target.value})}/></label><button className="primary">Add Employee</button></form>
        <div className="card"><h2>All employees</h2><div className="employee-list">{employeeList.length ? employeeList.map(emp => <div className="employee-row" key={emp.id}><div><strong>{emp.name}</strong><span>{emp.employeeId || "No employee ID"} · {money(emp.hourlyRate)}/hr</span></div><button className="danger" onClick={() => deleteEmployee(emp.id)}>Delete</button></div>) : <p>No employees added yet.</p>}</div></div>
      </section>}

      {tab === "summary" && <section><div className="actions"><button onClick={() => exportExcel(employeeSummary, "employee-summary.xlsx")}>Export Excel</button><button onClick={() => exportPdf(employeeSummary, "employee-summary.pdf")}>Export PDF</button></div><div className="card table-wrap"><table><thead><tr><th>Employee</th><th>Payroll Records</th><th>Total Hours</th><th>Total Earned</th></tr></thead><tbody>{employeeSummary.map(row => <tr key={row.employeeId}><td><strong>{row.employeeName}</strong></td><td>{row.payrollCount}</td><td>{row.hours.toFixed(2)}</td><td>{money(row.earnings)}</td></tr>)}</tbody></table></div></section>}

      {tab === "history" && <section><div className="actions"><button onClick={() => exportExcel()}>Export Excel</button><button onClick={() => exportPdf()}>Export PDF</button></div><div className="card table-wrap"><table><thead><tr><th>Employee</th><th>Week Ending</th><th>Rate</th><th>Hours</th><th>Amount Earned</th><th></th></tr></thead><tbody>{historyRows.length ? historyRows.map(row => <tr key={row.id}><td><strong>{row.employeeName}</strong><small>{row.employeeNumber}</small></td><td>{row.weekEnding}</td><td>{money(row.hourlyRate)}</td><td>{Number(row.totalHours).toFixed(2)}</td><td>{money(row.grossPay)}</td><td><button className="danger" onClick={() => deletePayroll(row.id)}>Delete</button></td></tr>) : <tr><td colSpan="6">No payroll history yet.</td></tr>}</tbody></table></div></section>}
    </main>
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
