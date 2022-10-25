import { DebugElement } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { UserserviceService } from '../services/userservice.service';
import { By } from '@angular/platform-browser';

import { UserComponent } from './user.component';

describe('UserComponent', () => {
  let component: UserComponent;
  let fixture: ComponentFixture<UserComponent>;
  let userservice : UserserviceService  ;
  let htmlPage: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UserComponent);
    component = fixture.componentInstance;
    // using Service
    userservice = TestBed.get(UserserviceService) 
    // Using HTML
    htmlPage=fixture.debugElement;
    fixture.detectChanges();
  });

  it('Test Function Service spy', fakeAsync(() => {
   // expect(component).toBeTruthy();

   spyOn(userservice, "getValue")
  // component.ngOnInit()
   tick(5000)
   userservice.getValue()
  // expect(userservice.getValue()).toEqual("real value")
   expect(userservice.getValue).toHaveBeenCalled()
   expect(userservice.getValue).toHaveBeenCalledTimes(1)
  }));


    it(" Test clicked function in ts file called", ()=>{
        
     // Get button By ID
      var button = htmlPage.query(By.css("#ButTestID"))
     // test call ison befour call button
      console.log(component.isOn)
     // call button
      button.triggerEventHandler("click", null)
     // call IsOn after call button 
      console.log(component.isOn)
      // Test is value is true 
      expect(component.isOn).toBeTrue();

    })


});

///////////////////////////



