# Time Tracking Approval Workflow System

## Overview
The time tracking system now includes the same comprehensive approval workflow that was implemented for leaves. Manual time entries require approval from designated approvers before being accepted into the system.

## Features

### 🔄 Multi-Level Approval Workflow
- Support for multi-level approval chains
- Configurable approval workflows per company
- Different approver types: Line Manager, HR Manager, Department Head, CEO, Project Manager

### 📧 Email Notifications
- Automatic email notifications to approvers when time entries are submitted
- Email notifications for approvals and rejections
- Template-based emails with complete time entry details

### 📊 Role-Based Access Control
- Different views for employees, managers, and admins
- Permission-based actions (approve, view, edit)
- Dashboard for pending approvals

### 📈 Comprehensive Tracking
- Full approval history tracking
- Current approval level tracking
- Status management (pending, approved, rejected)

## API Endpoints

### Basic Operations
```
POST   /time-tracking                    - Create time tracking entry
GET    /time-tracking                    - Get all time tracking entries (with filters)
GET    /time-tracking/entry              - Get specific time tracking entry
PUT    /time-tracking/update             - Update time tracking entry
```

### Approval Operations
```
POST   /time-tracking/approve            - Approve/Reject time entry
GET    /time-tracking/pending-approvals  - Get pending approvals for current user
GET    /time-tracking/approval-dashboard - Get approval dashboard data
```

## How It Works

### 1. Time Entry Creation
When a user creates a **manual** time entry:
1. System fetches employee details using `userId`
2. Checks for workflow configuration with transaction type "time_tracking"
3. If workflow exists, sets up approval chain
4. Sends email notification to first approver
5. Entry status is set to "pending"

For **geo** entries:
- No approval required
- Direct approval (status: "approved")

### 2. Approval Process
1. Approver receives email notification
2. Approver can approve or reject with comments
3. If approved and more levels exist, moves to next level
4. If final approval, entry is marked as "approved"
5. If rejected at any level, entire entry is rejected

### 3. Email Notifications
The system sends emails for:
- **Time Entry Approval Required** - To approvers
- **Time Entry Approved** - To employee when finally approved
- **Time Entry Rejected** - To employee when rejected

## Database Schema Changes

### TimeTrackingModel Updates
```javascript
{
  // Existing fields...
  companyId: String,
  userId: String,
  day: String,
  dateString: String,
  timeIn: String,
  timeOut: String,
  hours: String,
  method: String, // "manual" or "geo"
  status: String, // "pending", "approved", "rejected"
  longitude: Number,
  latitude: Number,
  
  // New Approval Workflow Fields
  workflowId: ObjectId,
  currentLevel: String,
  approverLevels: Map,
  currentApprovers: Array,
  approvalHistory: Array,
  employeeInfo: Object,
  finalApprovalDate: Date,
  finalApprover: ObjectId,
  rejectedBy: ObjectId,
  rejectedAt: Date,
  rejectionReason: String,
  comments: String,
  reason: String
}
```

## Usage Examples

### 1. Creating a Manual Time Entry (Requires Approval)
```javascript
POST /time-tracking?companyId=comp123&userId=user456
{
  "day": "Monday",
  "dateString": "2024-01-15",
  "timeIn": "09:00",
  "timeOut": "17:00",
  "hours": "8",
  "method": "manual",
  "reason": "Working from home",
  "comments": "Internet issues, had to work manually"
}
```

### 2. Creating a Geo Time Entry (Auto-Approved)
```javascript
POST /time-tracking?companyId=comp123&userId=user456
{
  "day": "Tuesday",
  "dateString": "2024-01-16",
  "timeIn": "09:15",
  "timeOut": "17:30",
  "hours": "8.25",
  "method": "geo",
  "longitude": 18.270721,
  "latitude": 13.082680
}
```

### 3. Approving a Time Entry
```javascript
POST /time-tracking/approve?id=entry123
{
  "approverId": "approver456",
  "action": "approved",
  "comments": "Approved as per policy"
}
```

### 4. Rejecting a Time Entry
```javascript
POST /time-tracking/approve?id=entry123
{
  "approverId": "approver456",
  "action": "rejected",
  "rejectionReason": "Insufficient documentation for manual entry",
  "comments": "Please provide proper justification"
}
```

### 5. Getting Pending Approvals
```javascript
GET /time-tracking/pending-approvals?currentUserId=approver456&companyId=comp123
```

### 6. Getting Time Entries with Role-Based Data
```javascript
// Employee view - own entries + pending approvals
GET /time-tracking?companyId=comp123&userId=user456&currentUserId=user456

// Manager view - only pending approvals
GET /time-tracking?companyId=comp123&currentUserId=manager789&viewType=pending-approvals

// Admin view - all company entries
GET /time-tracking?companyId=comp123&currentUserId=admin012&viewType=all-entries
```

## Workflow Configuration

To enable time tracking approval workflow, create a workflow document in the `workflow` collection:

```javascript
{
  "companyId": "comp123",
  "transactionType": {
    "id": "time_tracking",
    "name": "Time Tracking Approval"
  },
  "approvalChain": {
    "0": [
      {
        "id": "line_manager",
        "title": "Line Manager",
        "isRequired": true
      }
    ],
    "1": [
      {
        "id": "hr_manager",
        "title": "HR Manager",
        "isRequired": true
      }
    ]
  }
}
```

## Integration with Existing System

### Employee Model Integration
The system uses the existing `EmployeeModel` to:
- Fetch employee details for approver identification
- Get line manager information
- Determine user roles and permissions

### Email System Integration
Uses the existing email system with enhanced templates for:
- Time entry approval notifications
- Approval/rejection confirmations
- Status updates

### Workflow Model Integration
Leverages the existing `WorkflowModel` used by leaves system:
- Same approver types and logic
- Consistent approval chain structure
- Reusable workflow configuration

## Benefits

1. **Consistency** - Same approval workflow as leaves system
2. **Flexibility** - Configurable multi-level approval chains
3. **Transparency** - Complete audit trail of all approvals
4. **Automation** - Automatic email notifications and workflow progression
5. **Role-Based Access** - Different views and permissions based on user role
6. **Scalability** - Supports complex organizational structures

## Next Steps

1. Configure workflow documents for companies requiring time tracking approval
2. Set up line managers in employee profiles
3. Test the approval workflow with sample data
4. Train users on the new approval process
5. Monitor and optimize based on usage patterns 