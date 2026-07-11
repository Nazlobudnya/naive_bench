import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { HelloRequestDto } from "./dto/hello-request.dto";
import { HelloService } from "./hello.service";

@Controller("hello")
export class HelloController {
  constructor(private readonly helloService: HelloService) {}

  @Post()
  @UseGuards(AuthGuard)
  hello(@Body() body: HelloRequestDto): string {
    return this.helloService.greet(body.name, body.org);
  }
}
