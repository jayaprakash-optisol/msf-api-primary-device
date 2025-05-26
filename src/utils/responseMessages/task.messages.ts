export const taskResponse = {
  errors: {
    notFound: 'Task not found',
    creationFailed: 'Failed to create task',
    updateFailed: 'Failed to update task',
    statusUpdateFailed: 'Failed to update task status',
    retrievalFailed: 'Failed to retrieve tasks',
    parcelItemsRetrievalFailed: 'Failed to retrieve parcel items',
    invalidStatus: 'Invalid task status provided',
    databaseError: 'Database error occurred while processing task',
  },
  success: {
    created: 'Task created successfully',
    updated: 'Task updated successfully',
    statusUpdated: 'Task status updated successfully',
    retrieved: 'Tasks retrieved successfully',
    parcelItemsRetrieved: 'Parcel items retrieved successfully',
    found: 'Task found successfully',
  },
};
