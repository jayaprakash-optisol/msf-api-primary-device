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
      // Common field definitions
      CommonFields: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
          sourceSystem: {
            type: 'string',
            description: 'Source system identifier',
            nullable: true,
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        required: ['total', 'page', 'limit', 'totalPages'],
        properties: {
          total: {
            type: 'integer',
            description: 'Total number of items',
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
      // Reusable field types
      UuidField: {
        type: 'string',
        format: 'uuid',
      },
      NullableString: {
        type: 'string',
        nullable: true,
      },
      NullableInteger: {
        type: 'integer',
        nullable: true,
      },
      // Base response structure
      BaseResponse: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: {
            type: 'boolean',
          },
          message: {
            type: 'string',
          },
        },
      },
      // Paginated list response structure
      PaginatedListResponse: {
        allOf: [
          { $ref: '#/components/schemas/PaginationMeta' },
          {
            type: 'object',
            required: ['items'],
            properties: {
              items: {
                type: 'array',
              },
            },
          },
        ],
      },
      Guest: {
        allOf: [
          { $ref: '#/components/schemas/CommonFields' },
          {
            type: 'object',
            required: ['username', 'role', 'status'],
            properties: {
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
            },
          },
        ],
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
        allOf: [
          { $ref: '#/components/schemas/CommonFields' },
          {
            type: 'object',
            required: ['status'],
            properties: {
              parcelId: {
                allOf: [
                  { $ref: '#/components/schemas/UuidField' },
                  {
                    description: 'Associated parcel ID',
                    nullable: true,
                  },
                ],
              },
              status: {
                $ref: '#/components/schemas/TaskStatus',
              },
              itemType: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Type of items in the task',
                  },
                ],
              },
            },
          },
        ],
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
            allOf: [
              { $ref: '#/components/schemas/UuidField' },
              {
                description: 'Associated parcel ID',
              },
            ],
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
        allOf: [
          { $ref: '#/components/schemas/BaseResponse' },
          {
            type: 'object',
            required: ['data'],
            properties: {
              success: {
                example: true,
              },
              message: {
                example: 'Task created successfully',
              },
              data: {
                $ref: '#/components/schemas/Task',
              },
            },
          },
        ],
      },
      TaskListResponse: {
        allOf: [
          { $ref: '#/components/schemas/BaseResponse' },
          {
            type: 'object',
            required: ['data'],
            properties: {
              success: {
                example: true,
              },
              message: {
                example: 'Tasks retrieved successfully',
              },
              data: {
                allOf: [
                  { $ref: '#/components/schemas/PaginatedListResponse' },
                  {
                    type: 'object',
                    properties: {
                      items: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/TaskWithRelations',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      Parcel: {
        allOf: [
          { $ref: '#/components/schemas/CommonFields' },
          {
            type: 'object',
            properties: {
              purchaseOrderNumber: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Purchase order number',
                  },
                ],
              },
              parcelFrom: {
                allOf: [
                  { $ref: '#/components/schemas/NullableInteger' },
                  {
                    description: 'Source location code',
                  },
                ],
              },
              parcelTo: {
                allOf: [
                  { $ref: '#/components/schemas/NullableInteger' },
                  {
                    description: 'Destination location code',
                  },
                ],
              },
              totalWeight: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Total weight of the parcel',
                  },
                ],
              },
              totalVolume: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Total volume of the parcel',
                  },
                ],
              },
              totalNumberOfParcels: {
                allOf: [
                  { $ref: '#/components/schemas/NullableInteger' },
                  {
                    description: 'Total number of parcels',
                  },
                ],
              },
              packingListNumber: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Packing list number',
                  },
                ],
              },
            },
          },
        ],
      },
      ParcelItem: {
        allOf: [
          { $ref: '#/components/schemas/CommonFields' },
          {
            type: 'object',
            required: ['parcelId'],
            properties: {
              productId: {
                allOf: [
                  { $ref: '#/components/schemas/UuidField' },
                  {
                    description: 'Associated product ID',
                    nullable: true,
                  },
                ],
              },
              parcelId: {
                allOf: [
                  { $ref: '#/components/schemas/UuidField' },
                  {
                    description: 'Associated parcel ID',
                  },
                ],
              },
              productQuantity: {
                allOf: [
                  { $ref: '#/components/schemas/NullableInteger' },
                  {
                    description: 'Quantity of the product',
                  },
                ],
              },
              productCode: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Product code',
                  },
                ],
              },
              expiryDate: {
                type: 'string',
                format: 'date-time',
                description: 'Product expiry date',
                nullable: true,
              },
              batchNumber: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Batch number',
                  },
                ],
              },
              weight: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Weight of the item',
                  },
                ],
              },
              volume: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Volume of the item',
                  },
                ],
              },
              parcelNumber: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Parcel number',
                  },
                ],
              },
              lineNumber: {
                allOf: [
                  { $ref: '#/components/schemas/NullableInteger' },
                  {
                    description: 'Line number in the parcel',
                  },
                ],
              },
              externalRef: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'External reference',
                  },
                ],
              },
              unitOfMeasure: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Unit of measure',
                  },
                ],
              },
              currencyUnit: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Currency unit',
                  },
                ],
              },
              unitPrice: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Unit price',
                  },
                ],
              },
              messageEsc1: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Message field 1',
                  },
                ],
              },
              messageEsc2: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Message field 2',
                  },
                ],
              },
              comments: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Comments',
                  },
                ],
              },
              contains: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Contents description',
                  },
                ],
              },
            },
          },
        ],
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
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Packing list number from parcel',
                  },
                ],
              },
            },
          },
        ],
      },
      Product: {
        allOf: [
          { $ref: '#/components/schemas/CommonFields' },
          {
            type: 'object',
            properties: {
              unidataId: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Unidata ID',
                  },
                ],
              },
              productCode: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Product code',
                  },
                ],
              },
              productDescription: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Product description',
                  },
                ],
              },
              type: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Product type',
                  },
                ],
              },
              state: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Product state',
                  },
                ],
              },
              freeCode: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Free code',
                  },
                ],
              },
              standardizationLevel: {
                allOf: [
                  { $ref: '#/components/schemas/NullableString' },
                  {
                    description: 'Standardization level',
                  },
                ],
              },
              labels: {
                type: 'object',
                description: 'Product labels',
                nullable: true,
              },
            },
          },
        ],
      },
      ParcelItemsResponse: {
        allOf: [
          { $ref: '#/components/schemas/BaseResponse' },
          {
            type: 'object',
            required: ['data'],
            properties: {
              success: {
                example: true,
              },
              message: {
                example: 'Parcel items retrieved successfully',
              },
              data: {
                allOf: [
                  { $ref: '#/components/schemas/PaginatedListResponse' },
                  {
                    type: 'object',
                    properties: {
                      items: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/ParcelItemWithProduct',
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
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
