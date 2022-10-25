import { TestBed } from '@angular/core/testing';

import { UserserviceService } from './userservice.service';
import {
   waitForAsync
} from '@angular/core/testing'

describe('UserserviceService', () => {
  let service: UserserviceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserserviceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
describe('userService', () => {
  let service: UserserviceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserserviceService);
  });


  it('Test Call Get value', () => {
    expect(service.getValue()).toEqual('real value')
  });


})
