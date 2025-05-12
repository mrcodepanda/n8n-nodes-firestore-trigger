# Firestore Trigger Example Workflows

This document provides ready-to-use example workflows that demonstrate how to use the Firestore Trigger node in n8n.

## Basic Collection Monitoring Workflow

This workflow triggers whenever a document is added, modified, or removed in a collection and sends a Slack notification.

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "listenToCollection",
        "collection": "users",
        "events": [
          "added",
          "modified",
          "removed"
        ]
      },
      "name": "Firestore Trigger",
      "type": "n8n-nodes-firestore-trigger",
      "position": [
        250,
        300
      ],
      "typeVersion": 1
    },
    {
      "parameters": {
        "channel": "#notifications",
        "text": "=Document {{ $json.changeType }}: {{ $json.id }}\nData: ```json\n{{ JSON.stringify($json.data, null, 2) }}\n```\nTimestamp: {{ new Date($json.timestamp).toLocaleString() }}",
        "attachments": []
      },
      "name": "Slack",
      "type": "n8n-nodes-base.slack",
      "position": [
        500,
        300
      ],
      "typeVersion": 1
    }
  ],
  "connections": {
    "Firestore Trigger": {
      "main": [
        [
          {
            "node": "Slack",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Document Change Notification Workflow

This workflow monitors a specific document and sends an email when it changes.

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "listenToDocument",
        "collection": "orders",
        "documentId": "order-123",
        "options": {
          "includeMetadataChanges": true
        }
      },
      "name": "Firestore Trigger",
      "type": "n8n-nodes-firestore-trigger",
      "position": [
        250,
        300
      ],
      "typeVersion": 1
    },
    {
      "parameters": {
        "to": "admin@example.com",
        "subject": "Order {{ $json.id }} Updated",
        "text": "The order document has been updated:\n\nOrder ID: {{ $json.id }}\nStatus: {{ $json.data.status }}\nUpdated at: {{ new Date($json.timestamp).toLocaleString() }}\n\nFull data: \n{{ JSON.stringify($json.data, null, 2) }}"
      },
      "name": "Send Email",
      "type": "n8n-nodes-base.emailSend",
      "position": [
        500,
        300
      ],
      "typeVersion": 1
    }
  ],
  "connections": {
    "Firestore Trigger": {
      "main": [
        [
          {
            "node": "Send Email",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Subcollection Pattern Monitoring Workflow

This workflow monitors for new orders from any user and creates a task in Asana.

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "listenToCollection",
        "collection": "users/:userId/orders",
        "events": [
          "added"
        ]
      },
      "name": "Firestore Trigger",
      "type": "n8n-nodes-firestore-trigger",
      "position": [
        250,
        300
      ],
      "typeVersion": 1
    },
    {
      "parameters": {
        "workspaceId": {
          "workspace": "your-workspace-id"
        },
        "projectId": {
          "project": "your-project-id"
        },
        "name": "=New order {{ $json.id }} from user {{ $json.path.split('/')[1] }}",
        "description": "=Order details:\n\nAmount: ${{ $json.data.amount }}\nItems: {{ $json.data.items?.length || 0 }}\nNotes: {{ $json.data.notes || 'No notes' }}\n\nReference: {{ $json.path }}",
        "dueDate": {
          "date": "={{ new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }}"
        }
      },
      "name": "Asana",
      "type": "n8n-nodes-base.asana",
      "position": [
        500,
        300
      ],
      "typeVersion": 1
    }
  ],
  "connections": {
    "Firestore Trigger": {
      "main": [
        [
          {
            "node": "Asana",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Filtered Collection Listener Workflow

This workflow uses query filters to only trigger for high-priority items.

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "listenToCollection",
        "collection": "tasks",
        "events": [
          "added",
          "modified"
        ],
        "options": {
          "queryFilters": {
            "filters": [
              {
                "field": "priority",
                "operator": "==",
                "value": "high"
              },
              {
                "field": "status",
                "operator": "!=",
                "value": "completed"
              }
            ]
          }
        }
      },
      "name": "Firestore Trigger",
      "type": "n8n-nodes-firestore-trigger",
      "position": [
        250,
        300
      ],
      "typeVersion": 1
    },
    {
      "parameters": {
        "resource": "message",
        "channel": "your-channel-id",
        "text": "=🚨 High Priority Task Alert 🚨\n\nTask: {{ $json.data.title }}\nAssigned to: {{ $json.data.assignee }}\nDue date: {{ $json.data.dueDate }}\n\nDescription: {{ $json.data.description }}"
      },
      "name": "Telegram",
      "type": "n8n-nodes-base.telegram",
      "position": [
        500,
        300
      ],
      "typeVersion": 1
    }
  ],
  "connections": {
    "Firestore Trigger": {
      "main": [
        [
          {
            "node": "Telegram",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## How to Import These Examples

1. In your n8n instance, go to Workflows > New
2. Click "Import from URL or file"
3. Copy and paste the JSON code for the example you want
4. Update any necessary credentials and parameters
5. Save and activate the workflow

## Custom Adaptation

You'll need to customize these examples with:

1. Your specific Firestore collection paths
2. Credentials for the services you're using (Slack, Email, Asana, Telegram)
3. Specific field mappings that match your Firestore data structure

These examples are meant to be starting points - adapt them to your specific needs!
