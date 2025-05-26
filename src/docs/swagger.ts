import swaggerJSDoc from 'swagger-jsdoc';

import { version } from '../../package.json';
import env from '../config/env.config';

/**
 * Base definitions for API documentation
 */
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Documentation',
    version,
    description: 'API documentation for the application',
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    contact: {
      name: 'Dev',
      url: 'https:/localhost.com',
      email: 'support@localhost.com',
    },
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}${env.API_PREFIX}`,
      description: 'Development Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Guest: {
        type: 'object',
        required: ['id', 'username', 'role', 'status'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Guest ID',
          },
          firstName: {
            type: 'string',
            description: 'Guest first name',
          },
          lastName: {
            type: 'string',
            description: 'Guest last name',
          },
          location: {
            type: 'string',
            description: 'Guest location',
          },
          role: {
            type: 'string',
            description: 'Guest role',
          },
          accessPeriod: {
            type: 'string',
            description: 'Guest access period',
          },
          username: {
            type: 'string',
            description: 'Guest username',
          },
          status: {
            type: 'string',
            description: 'Guest account status',
          },
          credentialsViewed: {
            type: 'boolean',
            description: 'Whether guest credentials have been viewed',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Guest creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Guest last update timestamp',
          },
        },
      },
      Error: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'string',
            example: 'Error message',
          },
        },
      },
      TaskStatus: {
        type: 'string',
        enum: ['Yet to Start', 'In Progress', 'Paused', 'Submitted'],
        description: 'Task status enumeration',
      },
      Task: {
        type: 'object',
        required: ['id', 'status', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Task ID',
          },
          parcelId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated parcel ID',
            nullable: true,
          },
          status: {
            $ref: '#/components/schemas/TaskStatus',
          },
          itemType: {
            type: 'string',
            description: 'Type of items in the task',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Task creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Task last update timestamp',
          },
        },
      },
      TaskWithRelations: {
        allOf: [
          { $ref: '#/components/schemas/Task' },
          {
            type: 'object',
            properties: {
              parcel: {
                $ref: '#/components/schemas/Parcel',
                nullable: true,
              },
              parcelItems: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/ParcelItem',
                },
              },
            },
          },
        ],
      },
      TaskCreate: {
        type: 'object',
        required: ['parcelId'],
        properties: {
          parcelId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated parcel ID',
          },
          status: {
            $ref: '#/components/schemas/TaskStatus',
            description: 'Task status (defaults to "Yet to Start")',
          },
          itemType: {
            type: 'string',
            description: 'Type of items in the task',
          },
        },
      },
      TaskStatusUpdate: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            $ref: '#/components/schemas/TaskStatus',
          },
        },
      },
      TaskResponse: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Task created successfully',
          },
          data: {
            $ref: '#/components/schemas/Task',
          },
        },
      },
      TaskListResponse: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Tasks retrieved successfully',
          },
          data: {
            type: 'object',
            required: ['items', 'total', 'page', 'limit', 'totalPages'],
            properties: {
              items: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/TaskWithRelations',
                },
              },
              total: {
                type: 'integer',
                description: 'Total number of tasks',
              },
              page: {
                type: 'integer',
                description: 'Current page number',
              },
              limit: {
                type: 'integer',
                description: 'Number of items per page',
              },
              totalPages: {
                type: 'integer',
                description: 'Total number of pages',
              },
            },
          },
        },
      },
      Parcel: {
        type: 'object',
        required: ['id', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Parcel ID',
          },
          purchaseOrderNumber: {
            type: 'string',
            description: 'Purchase order number',
            nullable: true,
          },
          parcelFrom: {
            type: 'integer',
            description: 'Source location code',
            nullable: true,
          },
          parcelTo: {
            type: 'integer',
            description: 'Destination location code',
            nullable: true,
          },
          totalWeight: {
            type: 'string',
            description: 'Total weight of the parcel',
            nullable: true,
          },
          totalVolume: {
            type: 'string',
            description: 'Total volume of the parcel',
            nullable: true,
          },
          totalNumberOfParcels: {
            type: 'integer',
            description: 'Total number of parcels',
            nullable: true,
          },
          packingListNumber: {
            type: 'string',
            description: 'Packing list number',
            nullable: true,
          },
          sourceSystem: {
            type: 'string',
            description: 'Source system identifier',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Parcel creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Parcel last update timestamp',
          },
        },
      },
      ParcelItem: {
        type: 'object',
        required: ['id', 'parcelId', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Parcel item ID',
          },
          productId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated product ID',
            nullable: true,
          },
          parcelId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated parcel ID',
          },
          productQuantity: {
            type: 'integer',
            description: 'Quantity of the product',
            nullable: true,
          },
          productCode: {
            type: 'string',
            description: 'Product code',
            nullable: true,
          },
          expiryDate: {
            type: 'string',
            format: 'date-time',
            description: 'Product expiry date',
            nullable: true,
          },
          batchNumber: {
            type: 'string',
            description: 'Batch number',
            nullable: true,
          },
          weight: {
            type: 'string',
            description: 'Weight of the item',
            nullable: true,
          },
          volume: {
            type: 'string',
            description: 'Volume of the item',
            nullable: true,
          },
          parcelNumber: {
            type: 'string',
            description: 'Parcel number',
            nullable: true,
          },
          lineNumber: {
            type: 'integer',
            description: 'Line number in the parcel',
            nullable: true,
          },
          externalRef: {
            type: 'string',
            description: 'External reference',
            nullable: true,
          },
          unitOfMeasure: {
            type: 'string',
            description: 'Unit of measure',
            nullable: true,
          },
          currencyUnit: {
            type: 'string',
            description: 'Currency unit',
            nullable: true,
          },
          unitPrice: {
            type: 'string',
            description: 'Unit price',
            nullable: true,
          },
          messageEsc1: {
            type: 'string',
            description: 'Message field 1',
            nullable: true,
          },
          messageEsc2: {
            type: 'string',
            description: 'Message field 2',
            nullable: true,
          },
          comments: {
            type: 'string',
            description: 'Comments',
            nullable: true,
          },
          contains: {
            type: 'string',
            description: 'Contents description',
            nullable: true,
          },
          sourceSystem: {
            type: 'string',
            description: 'Source system identifier',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Item creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Item last update timestamp',
          },
        },
      },
      ParcelItemWithProduct: {
        allOf: [
          { $ref: '#/components/schemas/ParcelItem' },
          {
            type: 'object',
            properties: {
              product: {
                $ref: '#/components/schemas/Product',
                nullable: true,
              },
              packingListNumber: {
                type: 'string',
                description: 'Packing list number from parcel',
                nullable: true,
              },
            },
          },
        ],
      },
      Product: {
        type: 'object',
        required: ['id', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Product ID',
          },
          unidataId: {
            type: 'string',
            description: 'Unidata ID',
            nullable: true,
          },
          productCode: {
            type: 'string',
            description: 'Product code',
            nullable: true,
          },
          productDescription: {
            type: 'string',
            description: 'Product description',
            nullable: true,
          },
          type: {
            type: 'string',
            description: 'Product type',
            nullable: true,
          },
          state: {
            type: 'string',
            description: 'Product state',
            nullable: true,
          },
          freeCode: {
            type: 'string',
            description: 'Free code',
            nullable: true,
          },
          standardizationLevel: {
            type: 'string',
            description: 'Standardization level',
            nullable: true,
          },
          labels: {
            type: 'object',
            description: 'Product labels',
            nullable: true,
          },
          sourceSystem: {
            type: 'string',
            description: 'Source system identifier',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Product creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Product last update timestamp',
          },
        },
      },
      ParcelItemsResponse: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Parcel items retrieved successfully',
          },
          data: {
            type: 'object',
            required: ['items', 'total', 'page', 'limit', 'totalPages'],
            properties: {
              items: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/ParcelItemWithProduct',
                },
              },
              total: {
                type: 'integer',
                description: 'Total number of parcel items',
              },
              page: {
                type: 'integer',
                description: 'Current page number',
              },
              limit: {
                type: 'integer',
                description: 'Number of items per page',
              },
              totalPages: {
                type: 'integer',
                description: 'Total number of pages',
              },
            },
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication information is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'Unauthorized',
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Insufficient privileges',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'Insufficient permissions to access this resource',
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'Resource not found',
            },
          },
        },
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error:
                'username: Invalid username format, password: Password must be at least 6 characters',
            },
          },
        },
      },
      ServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              error: 'Internal server error',
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Auth',
      description: 'Guest authentication endpoints',
    },
    {
      name: 'Files',
      description: 'File upload and processing endpoints',
    },
    {
      name: 'Tasks',
      description: 'Task management endpoints',
    },
  ],
};

/**
 * Options for the swagger docs
 */
const options = {
  swaggerDefinition,
  apis: ['./src/docs/index.yaml', './src/docs/routes/**/*.yaml'],
};

/**
 * Initialize swagger-jsdoc
 */
const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
