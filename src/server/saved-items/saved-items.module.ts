import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { TagsService } from './tags.service.js';
import { TagsController } from './tags.controller.js';
import { SavedItemsService } from './saved-items.service.js';
import { SavedItemsController } from './saved-items.controller.js';

@Module({
    imports: [DatabaseModule],
    controllers: [TagsController, SavedItemsController],
    providers: [TagsService, SavedItemsService],
    exports: [TagsService, SavedItemsService],
})
export class SavedItemsModule {}
