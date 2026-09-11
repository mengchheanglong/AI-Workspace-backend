import { Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_DRIVER } from './storage.interface';

@Module({
  providers: [
    LocalStorageService,
    {
      provide: STORAGE_DRIVER,
      useExisting: LocalStorageService,
    },
  ],
  exports: [LocalStorageService, STORAGE_DRIVER],
})
export class StorageModule {}
