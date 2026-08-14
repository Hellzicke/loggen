import { useEffect, useState } from 'react'

type Employee = { employeeId: string; name: string }
type Manager = { id: string; name: string }
type EmployeesResponse = { onDuty: Employee[]; others: Employee[]; managers: Manager[] }

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
}

export default function EmployeeNameInput({
  value,
  onChange,
  placeholder = 'Ditt namn',
  selectClassName,
  autoFocus,
  onKeyDown,
}: Props) {
  const [employees, setEmployees] = useState<EmployeesResponse | null>(null)

  useEffect(() => {
    fetchEmployees()
      .then(data => setEmployees(data))
      .catch(console.error)
  }, [])

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
      {employees?.managers.length ? (
        <optgroup label="Ansvariga">
          {employees.managers.map(mgr => (
            <option key={mgr.id} value={mgr.name}>{mgr.name}</option>
          ))}
        </optgroup>
      ) : null}
    </select>
  )
}
