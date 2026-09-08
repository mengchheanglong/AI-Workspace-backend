import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('AI Project Workspace API')
      .setDescription(
        'Foundation endpoints only. Authentication and workspace features are not implemented yet.',
      )
      .setVersion('0.1.0')
      .build(),
  );
}
