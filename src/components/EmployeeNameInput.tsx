import { useEffect, useState } from 'react'

type Employee = { employeeId: string; name: string }
type EmployeesResponse = { onDuty: Employee[]; others: Employee[] }

let cached: EmployeesResponse | null = null
let cachedAt = 0
const TTL_MS = 5 * 60 * 1000

const fetchEmployees = async (): Promise<EmployeesResponse> => {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached
  const token = localStorage.getItem('authToken')
  const res = await fetch('/api/employees', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('fetch failed')
  const data: EmployeesResponse = await res.json()
  cached = data
  cachedAt = Date.now()
  return data
}

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  selectClassName?: string
  inputClassName?: string
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
  adminName?: string | null // Administratör som kan signera
}

export default function EmployeeNameInput({
  value,
  onChange,
  placeholder = 'Ditt namn',
  selectClassName,
  inputClassName,
  autoFocus,
  onKeyDown,
  adminName,
}: Props) {
  const [employees, setEmployees] = useState<EmployeesResponse | null>(null)

  useEffect(() => {
    fetchEmployees()
      .then(data => setEmployees(data))
      .catch(console.error)
  }, [])

  const hasList = employees && (employees.onDuty.length + employees.others.length) > 0

  // Visa alltid dropdown — ingen manuell input. Admins läggs till separat.
  return (
    <select
      className={selectClassName}
      value={value}
      onChange={e => onChange(e.target.value)}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
    >
      <option value="" disabled>Välj namn</option>
      {employees?.onDuty.length ? (
        <optgroup label="På plats idag">
          {employees.onDuty.map(emp => (
            <option key={emp.employeeId} value={emp.name}>{emp.name}</option>
          ))}
        </optgroup>
      ) : null}
      {employees?.others.length ? (
        <optgroup label="Övrig personal">
          {employees.others.map(emp => (
            <option key={emp.employeeId} value={emp.name}>{emp.name}</option>
          ))}
        </optgroup>
      ) : null}
      {adminName && (
        <optgroup label="Administratörer">
          <option value={adminName}>{adminName}</option>
        </optgroup>
      )}
    </select>
  )
}
