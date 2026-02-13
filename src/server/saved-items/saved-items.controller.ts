import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { SavedItemsService } from './saved-items.service.js';

@Controller('saved-items')
export class SavedItemsController {
    constructor(private readonly savedItemsService: SavedItemsService) {}

    @Get()
    async list(
        @Query('tagId') tagId?: string,
        @Query('workspace') workspace?: string,
    ) {
        const data = await this.savedItemsService.findAll({ tagId, workspace });
        return { success: true, data };
    }

    @Get(':id')
    async get(@Param('id') id: string) {
        const data = await this.savedItemsService.findById(id);
        if (!data) throw new HttpException('Saved item not found', HttpStatus.NOT_FOUND);
        return { success: true, data };
    }

    @Post()
    async create(
        @Body()
        body: {
            url: string;
            title?: string;
            workspace?: string;
            tagNames?: string[];
            tagIds?: string[];
        },
    ) {
        const data = await this.savedItemsService.create({
            url: body.url,
            title: body.title,
            workspace: body.workspace,
            tagNames: body.tagNames,
            tagIds: body.tagIds,
        });
        return { success: true, data };
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        await this.savedItemsService.delete(id);
        return { success: true };
    }
}
