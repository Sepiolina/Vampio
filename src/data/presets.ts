import { PresetSchema } from '../types';

export const PRESET_SCHEMAS: PresetSchema[] = [
  {
    id: 'default-demo',
    name: 'Hardware & Logistics',
    description: 'Demonstrates Sequence, Hex MAC addresses, Float ranges, and dependent Weight Calculations.',
    category: 'Logistics',
    tableName: 'logistics_metrics',
    columns: [
      { id: '1', name: 'Serial_Num', type: 'Sequence', rule: '1000', skip_pct: 0, condition: '' },
      { id: '2', name: 'HTTP_Method', type: 'Set/Enum', rule: 'GET:50, POST:30, PUT:15, DELETE:5', skip_pct: 0, condition: '' },
      { id: '3', name: 'MAC_Address', type: 'Blob/Hex', rule: '6', skip_pct: 0, condition: '' },
      { id: '4', name: 'Net_Weight', type: 'Float', rule: '10.0, 45.0, 2', skip_pct: 5, condition: '' },
      { id: '5', name: 'Tare_Weight', type: 'Float', rule: '1.5, 4.0, 2', skip_pct: 0, condition: '' },
      { id: '6', name: 'Total_Weight', type: 'Calculation', rule: '{Net_Weight} + {Tare_Weight}', skip_pct: 0, condition: 'Net_Weight' },
      { id: '7', name: 'Tracking_UUID', type: 'UUID', rule: '', skip_pct: 0, condition: '' }
    ]
  },
  {
    id: 'ecommerce-orders',
    name: 'E-Commerce Orders',
    description: 'Complete checkout schema with customer info, item counts, pricing, discount calculations, and statuses.',
    category: 'Commerce',
    tableName: 'ecommerce_orders',
    columns: [
      { id: 'e1', name: 'Order_ID', type: 'Sequence', rule: '50000', skip_pct: 0, condition: '' },
      { id: 'e2', name: 'Customer_Name', type: 'Entity', rule: 'full_name', skip_pct: 0, condition: '' },
      { id: 'e3', name: 'Customer_Email', type: 'Entity', rule: 'email', skip_pct: 0, condition: '' },
      { id: 'e4', name: 'Item_Quantity', type: 'Int', rule: '1, 10', skip_pct: 0, condition: '' },
      { id: 'e5', name: 'Unit_Price', type: 'Float', rule: '12.50, 299.99, 2', skip_pct: 0, condition: '' },
      { id: 'e6', name: 'Discount_Rate', type: 'Float', rule: '0.0, 0.25, 2', skip_pct: 20, condition: '' },
      { id: 'e7', name: 'Order_Total', type: 'Calculation', rule: 'Math.round({Item_Quantity} * {Unit_Price} * (1 - {Discount_Rate}) * 100) / 100', skip_pct: 0, condition: '' },
      { id: 'e8', name: 'Order_Status', type: 'Set/Enum', rule: 'COMPLETED:70, PENDING:15, REFUNDED:10, CANCELLED:5', skip_pct: 0, condition: '' },
      { id: 'e9', name: 'Shipping_Country', type: 'Entity', rule: 'country', skip_pct: 0, condition: '' },
      { id: 'e10', name: 'Created_At', type: 'DateTime', rule: 'YYYY-MM-DD HH:mm:ss', skip_pct: 0, condition: '' }
    ]
  },
  {
    id: 'iot-telemetry',
    name: 'IoT Fleet Telemetry',
    description: 'Sensor packets including device ID regex, battery percentages, temperature, status, and alert flags.',
    category: 'IoT & Telemetry',
    tableName: 'sensor_telemetry',
    columns: [
      { id: 'i1', name: 'Device_UID', type: 'RegEx', rule: 'NODE-[A-Z]{3}-\\d{4}', skip_pct: 0, condition: '' },
      { id: 'i2', name: 'Packet_Seq', type: 'Sequence', rule: '1', skip_pct: 0, condition: '' },
      { id: 'i3', name: 'Temperature_C', type: 'Float', rule: '-10.5, 45.0, 1', skip_pct: 2, condition: '' },
      { id: 'i4', name: 'Relative_Humidity', type: 'Float', rule: '20.0, 95.0, 1', skip_pct: 2, condition: '' },
      { id: 'i5', name: 'Battery_Level_Pct', type: 'Int', rule: '12, 100', skip_pct: 0, condition: '' },
      { id: 'i6', name: 'Firmware_Hash', type: 'Blob/Hex', rule: '4', skip_pct: 0, condition: '' },
      { id: 'i7', name: 'Is_Anomaly', type: 'Boolean', rule: '10', skip_pct: 0, condition: '' },
      { id: 'i8', name: 'Recorded_At', type: 'DateTime', rule: 'ISO', skip_pct: 0, condition: '' }
    ]
  },
  {
    id: 'web-access-logs',
    name: 'Web Server Access Logs',
    description: 'Standard Nginx/Apache style access log generation with client IPs, endpoints, response codes, and latency.',
    category: 'Security & Ops',
    tableName: 'access_logs',
    columns: [
      { id: 'w1', name: 'Trace_ID', type: 'UUID', rule: '', skip_pct: 0, condition: '' },
      { id: 'w2', name: 'Client_IP', type: 'Entity', rule: 'ip_address', skip_pct: 0, condition: '' },
      { id: 'w3', name: 'HTTP_Method', type: 'Set/Enum', rule: 'GET:65, POST:20, PUT:8, DELETE:4, OPTIONS:3', skip_pct: 0, condition: '' },
      { id: 'w4', name: 'Status_Code', type: 'Set/Enum', rule: '200:80, 201:5, 304:5, 400:3, 401:2, 404:3, 500:2', skip_pct: 0, condition: '' },
      { id: 'w5', name: 'Latency_ms', type: 'Int', rule: '12, 850', skip_pct: 0, condition: '' },
      { id: 'w6', name: 'User_Agent', type: 'Entity', rule: 'user_agent', skip_pct: 10, condition: '' },
      { id: 'w7', name: 'Timestamp', type: 'DateTime', rule: 'ISO', skip_pct: 0, condition: '' }
    ]
  },
  {
    id: 'user-directory',
    name: 'User Accounts Directory',
    description: 'Profiles with full names, corporate roles, organizations, countries, and activation flags.',
    category: 'HR & Directory',
    tableName: 'user_accounts',
    columns: [
      { id: 'u1', name: 'User_ID', type: 'Sequence', rule: '1001', skip_pct: 0, condition: '' },
      { id: 'u2', name: 'Full_Name', type: 'Entity', rule: 'full_name', skip_pct: 0, condition: '' },
      { id: 'u3', name: 'Work_Email', type: 'Entity', rule: 'email', skip_pct: 0, condition: '' },
      { id: 'u4', name: 'Company', type: 'Entity', rule: 'company', skip_pct: 0, condition: '' },
      { id: 'u5', name: 'Job_Title', type: 'Entity', rule: 'job_title', skip_pct: 0, condition: '' },
      { id: 'u6', name: 'Country', type: 'Entity', rule: 'country', skip_pct: 0, condition: '' },
      { id: 'u7', name: 'Is_Active', type: 'Boolean', rule: '85', skip_pct: 0, condition: '' },
      { id: 'u8', name: 'Joined_Date', type: 'DateTime', rule: 'YYYY-MM-DD', skip_pct: 0, condition: '' }
    ]
  }
];
