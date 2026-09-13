import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { OpenAiChatCompletionDto } from './dto/openai-chat-completion.dto';
import { LogsQaService } from './logs-qa.service';

const MODEL_ID = 'logs-qa';

@ApiTags('OpenAI compatibility')
@Controller('v1')
export class OpenAiCompatibleController {
  constructor(private readonly logsQaService: LogsQaService) {}

  @Get('models')
  @ApiOperation({ summary: 'Lista modelos disponíveis para o Open WebUI' })
  listModels() {
    return {
      object: 'list',
      data: [
        {
          id: MODEL_ID,
          object: 'model',
          created: 0,
          owned_by: 'eximia',
        },
      ],
    };
  }

  @Post('chat/completions')
  @ApiOperation({
    summary: 'Adaptador OpenAI para perguntas analíticas sobre logs',
  })
  async createChatCompletion(
    @Body() body: OpenAiChatCompletionDto,
    @Res() response: Response,
  ): Promise<void> {
    const question = [...body.messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content.trim();

    if (!question) {
      throw new BadRequestException(
        'A conversa deve conter ao menos uma mensagem do usuário',
      );
    }

    const result = await this.logsQaService.ask(question);
    const id = `chatcmpl-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);

    if (body.stream) {
      this.writeStream(response, id, created, result.answer);
      return;
    }

    response.json({
      id,
      object: 'chat.completion',
      created,
      model: MODEL_ID,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: result.answer },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  }

  private writeStream(
    response: Response,
    id: string,
    created: number,
    answer: string,
  ): void {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.write(
      `data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model: MODEL_ID,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: answer },
            finish_reason: null,
          },
        ],
      })}\n\n`,
    );
    response.write(
      `data: ${JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        created,
        model: MODEL_ID,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      })}\n\n`,
    );
    response.end('data: [DONE]\n\n');
  }
}
