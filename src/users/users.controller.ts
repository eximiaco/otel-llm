import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly logger: Logger,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuários' })
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  async findAll() {
    const users = await this.usersService.findAll();
    this.logger.log(`GET: /users ${JSON.stringify({ users })}`);
    return users;
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado' })
  async findOne(@Param('userId', ParseUUIDPipe) userId: string) {
    const user = await this.usersService.findOne(userId);
    this.logger.log(`GET: /users/${userId} ${JSON.stringify(user)}`);
    return user;
  }

  @Post()
  @ApiOperation({ summary: 'Criar usuário' })
  @ApiCreatedResponse({ type: UserResponseDto })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    this.logger.log(`POST: /users`);
    return user;
  }
}
